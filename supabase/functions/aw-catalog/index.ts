import release from './release.json' with { type: 'json' }

// Read-only, reviewed public data. No database / privileged SDK / save access.
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
}
function authorized(req: Request) {
  const key = req.headers.get('apikey')
  if (!key) return false
  // New publishable keys are not JWTs. Validate the apikey here instead.
  try {
    const keys = Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}'))
    return keys.includes(key) || key === Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || key === Deno.env.get('SUPABASE_ANON_KEY')
  } catch { return false }
}
export function handler(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, {headers, status:204})
  if (!authorized(req)) return Response.json({error:'Invalid API key'}, {headers,status:401})
  if (req.method !== 'GET') return Response.json({error:'Read only'}, {headers,status:405})
  const url = new URL(req.url)
  if (url.searchParams.get('patch') === '1') {
    if (url.searchParams.get('version') !== release.manifest.version) return Response.json({error:'Catalog release changed; retry'}, {headers,status:409})
    const patch = release.patches.find(p => p.descriptor.baseVersion === url.searchParams.get('baseVersion'))
    if (!patch) return Response.json({error:'No direct patch; use latest full catalog'}, {headers,status:404})
    return Response.json(patch, {headers})
  }
  if (url.searchParams.get('bundle') === '1') {
    if (url.searchParams.get('version') !== release.manifest.version) return Response.json({error:'Catalog release changed; retry'}, {headers,status:409})
    return Response.json({manifest:release.manifest,payload:release.payload}, {headers})
  }
  return Response.json(release.manifest, {headers})
}
Deno.serve(handler)
