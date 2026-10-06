// Public release is read from the atomically committed Supabase release pointer.
import {headers as sharedHeaders,publishable,rpc,ApiError,failure} from '../_shared/aw-http.ts'
const headers={...sharedHeaders,'Access-Control-Allow-Methods':'GET, OPTIONS'}
export async function handler(req: Request) {
  if(req.method==='OPTIONS')return new Response(null,{headers,status:204})
  if(!publishable(req))return failure(new ApiError('AW_INVALID_API_KEY',401))
  if(req.method!=='GET')return failure(new ApiError('AW_METHOD_NOT_ALLOWED',405))
  const url=new URL(req.url)
  const kind=url.searchParams.get('patch')==='1'?'patch':url.searchParams.get('bundle')==='1'?'full':'manifest'
  try {
    const release=await rpc('aw_catalog_read',{p_kind:kind,p_version:url.searchParams.get('version'),p_base_version:url.searchParams.get('baseVersion')})
    return Response.json(release,{headers})
  } catch(error){return failure(error)}
}
Deno.serve(handler)
