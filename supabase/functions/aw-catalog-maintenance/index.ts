// The three business endpoints are paths of one Edge Function. No task KEY is logged.
import {protocol,publisher,checksum} from '../_shared/aw-protocol.mjs'
import {headers,publishable,rpc,ApiError,failure} from '../_shared/aw-http.ts'
const maxRequestBytes=256*1024
async function readBody(req: Request) {
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('AW_JSON_REQUIRED',415)
  if(Number(req.headers.get('content-length'))>maxRequestBytes)throw new ApiError('AW_REQUEST_TOO_LARGE',413)
  const reader=req.body?.getReader();if(!reader)throw new ApiError('AW_JSON_REQUIRED',400)
  const chunks: Uint8Array[]=[]; let total=0
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.length
    if(total>maxRequestBytes){await reader.cancel();throw new ApiError('AW_REQUEST_TOO_LARGE',413)}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  try {const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!body||Array.isArray(body)||typeof body!=='object')throw Error();return body}
  catch {throw new ApiError('AW_INVALID_JSON',400)}
}
function artifact(preview: any) {
  const s=preview.snapshot
  const content={catalog:protocol.encode(s.tables,s.checkedAt),ammoEvidence:s.ammoEvidence,presentation:s.presentation}
  // A server-selected sequence strictly advances the DB release, even for many publishes per day.
  const date=new Date(preview.published_at).toISOString().slice(0,10).replaceAll('-','.')
  const dayBase=Number(date.replaceAll('.',''))*10000
  const counter=Math.max(1,preview.base.manifest.sequence-dayBase+1)
  if(counter>9999)throw new ApiError('AW_RELEASE_SEQUENCE_EXHAUSTED',409)
  const bundle: any=publisher.full(content,date+'.'+counter,preview.published_at)
  const delta=publisher.patch(preview.base,bundle)
  bundle.manifest.patches=[delta.descriptor]
  return {...bundle,patches:[delta]}
}
export async function handler(req: Request) {
  if(req.method==='OPTIONS')return new Response(null,{headers,status:204})
  if(!publishable(req))return failure(new ApiError('AW_INVALID_API_KEY',401))
  const raw=req.headers.get('x-aw-key')||''
  if(raw.length<32||raw.length>256||!/^[A-Za-z0-9_-]+$/.test(raw))return failure(new ApiError('AW_UNAUTHORIZED',401))
  const tokenHash=checksum(raw),path=new URL(req.url).pathname.split('/').pop()
  const admin=(action: string,body: unknown={})=>rpc('aw_catalog_admin',{p_action:action,p_token_hash:tokenHash,p_body:body},true)
  try {
    if(req.method==='GET'&&path==='introspect')return Response.json(await admin('introspect'),{headers})
    if(req.method!=='POST')throw new ApiError('AW_METHOD_NOT_ALLOWED',405)
    const body=await readBody(req)
    if(path==='changes'){
      if(Object.keys(body).some(k=>!['request_id','change'].includes(k)))throw new ApiError('AW_INVALID_REQUEST',400)
      return Response.json(await admin('upload',body),{headers})
    }
    if(path==='reviews'){
      if(Object.keys(body).some(k=>k!=='request_id'))throw new ApiError('AW_INVALID_REQUEST',400)
      return Response.json(await admin('fetch',body),{headers})
    }
    if(path==='confirm'){
      if(Object.keys(body).some(k=>!['review_id','list_sha256','decision','reason'].includes(k)))throw new ApiError('AW_INVALID_REQUEST',400)
      if(body.decision==='reject')return Response.json(await admin('commit',body),{headers})
      const preview=await admin('preview',body)
      if(preview.decision)return Response.json(preview,{headers}) // Successful idempotent retry.
      let release
      try {release=artifact(preview)} catch(error){if(error instanceof ApiError)throw error;throw new ApiError('AW_PACKAGE_VALIDATION_FAILED',422)}
      // SQL atomically verifies actual after-images, persists full+patch, moves pointer and processes exact IDs.
      return Response.json(await admin('commit',{...body,snapshot:preview.snapshot,artifact:release}),{headers})
    }
    throw new ApiError('AW_ENDPOINT_NOT_FOUND',404)
  } catch(error) {return failure(error)}
}
Deno.serve(handler)
