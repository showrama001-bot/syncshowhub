import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Uploads a single file to DoodStream, Streamtape, and Voe.sx in parallel and
// returns whichever embed URLs succeeded. Failures don't block the others.

async function uploadToDoodstream(file: File): Promise<string> {
  const key = Deno.env.get('DOODSTREAM_API_KEY')
  if (!key) throw new Error('DOODSTREAM_API_KEY missing')
  const srv = await fetch(`https://doodapi.com/api/upload/server?key=${key}`).then((r) => r.json())
  const uploadUrl = srv?.result
  if (srv?.status !== 200 || !uploadUrl) throw new Error('Doodstream server unavailable')
  const fd = new FormData()
  fd.append('api_key', key)
  fd.append('file', file, file.name || 'upload.bin')
  const up = await fetch(uploadUrl, { method: 'POST', body: fd }).then((r) => r.json())
  const filecode = up?.result?.[0]?.filecode || up?.result?.filecode
  if (!filecode) throw new Error('Doodstream upload failed')
  return `https://dood.li/e/${filecode}`
}

async function uploadToStreamtape(file: File): Promise<string> {
  const login = Deno.env.get('STREAMTAPE_API_LOGIN')
  const key = Deno.env.get('STREAMTAPE_API_KEY')
  if (!login || !key) throw new Error('Streamtape credentials missing')
  const srv = await fetch(
    `https://api.streamtape.com/file/ul?login=${login}&key=${key}`,
  ).then((r) => r.json())
  const uploadUrl = srv?.result?.url
  if (srv?.status !== 200 || !uploadUrl) throw new Error('Streamtape server unavailable')
  const fd = new FormData()
  fd.append('file1', file, file.name || 'upload.bin')
  const up = await fetch(uploadUrl, { method: 'POST', body: fd }).then((r) => r.json())
  const id = up?.result?.id || up?.result?.url?.split('/').pop()
  if (!id) throw new Error('Streamtape upload failed')
  return `https://streamtape.com/e/${id}`
}

async function uploadToVoe(file: File): Promise<string> {
  const key = Deno.env.get('VOE_API_KEY')
  if (!key) throw new Error('VOE_API_KEY missing')
  // Voe.sx exposes a DoodStream-style upload server endpoint.
  const srv = await fetch(`https://voe.sx/api/upload/server?key=${key}`).then((r) => r.json())
  const uploadUrl = srv?.result || srv?.upload_url
  if (!uploadUrl) throw new Error('Voe upload server unavailable')
  const fd = new FormData()
  fd.append('api_key', key)
  fd.append('key', key)
  fd.append('file', file, file.name || 'upload.bin')
  const up = await fetch(uploadUrl, { method: 'POST', body: fd }).then((r) => r.json())
  const filecode =
    up?.result?.[0]?.filecode ||
    up?.result?.filecode ||
    up?.file?.filecode ||
    up?.filecode
  if (!filecode) throw new Error('Voe upload failed')
  return `https://voe.sx/e/${filecode}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token)
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // Admin-only: these provider accounts must not be used by arbitrary users.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const callerId = (claims.claims as any).sub as string
    const { data: roleRow } = await adminClient
      .from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin').maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admins only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Expected multipart/form-data with a "file" field' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const incoming = await req.formData()
    const file = incoming.get('file')
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing file' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fan-out: upload to all three servers in parallel. Each returns the embed URL or throws.
    const [dood, stape, voe] = await Promise.allSettled([
      uploadToDoodstream(file),
      uploadToStreamtape(file),
      uploadToVoe(file),
    ])

    const result = {
      doodstream_url: dood.status === 'fulfilled' ? dood.value : null,
      streamtape_url: stape.status === 'fulfilled' ? stape.value : null,
      voe_sx_url: voe.status === 'fulfilled' ? voe.value : null,
      errors: {
        doodstream: dood.status === 'rejected' ? String(dood.reason) : null,
        streamtape: stape.status === 'rejected' ? String(stape.reason) : null,
        voe: voe.status === 'rejected' ? String(voe.reason) : null,
      },
    }

    const anyOk = result.doodstream_url || result.streamtape_url || result.voe_sx_url
    if (!anyOk) {
      return new Response(JSON.stringify({ error: 'All uploads failed', detail: result.errors }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})