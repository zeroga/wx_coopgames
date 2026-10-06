export const headers = {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type, x-aw-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
export function publishable(req: Request) {
  const key=req.headers.get('apikey'); if(!key)return false
  try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')).includes(key)
    || key===Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || key===Deno.env.get('SUPABASE_ANON_KEY') } catch {return false}
}
export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) {super(code);this.code=code;this.status=status}
}
export function errorStatus(code: string) {
  if(code==='AW_UNAUTHORIZED')return 401
  if(/SCOPE_DENIED|RESOURCE_DENIED|ENVIRONMENT_MISMATCH/.test(code))return 403
  if(/QUOTA_EXCEEDED/.test(code))return 429
  if(/NOT_INITIALIZED/.test(code))return 503
  if(/NO_DIRECT_PATCH|REVIEW_NOT_FOUND/.test(code))return 404
  if(/CHANGED|MISMATCH|CONFLICT|PROCESSED|DIFFERS|PRIVATE_ARCHIVE_REFERENCE/.test(code))return 409
  return 400
}
export async function rpc(name: string, body: unknown, privileged=false) {
  const url=Deno.env.get('SUPABASE_URL')
  const key=Deno.env.get(privileged?'SUPABASE_SERVICE_ROLE_KEY':'SUPABASE_ANON_KEY')
  if(!url||!key)throw new ApiError('AW_SERVER_CONFIGURATION',503)
  let response: Response
  try {
    response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
  } catch {throw new ApiError('AW_DATABASE_UNAVAILABLE',503)}
  if(!response.ok){
    let code='AW_DATABASE_ERROR'
    try {const data=await response.json(); code=String(data.message||'').match(/\bAW_[A-Z_]+\b/)?.[0]||code} catch { /* no database detail/credentials in caller response */ }
    throw new ApiError(code,errorStatus(code))
  }
  return response.json()
}
export function failure(error: unknown) {
  const e=error instanceof ApiError?error:new ApiError('AW_SERVER_ERROR',500)
  return Response.json({error:e.code},{headers,status:e.status})
}
