const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const url = new URL(req.url);
  const fileId = url.searchParams.get("file_id")?.trim() ?? "";
  const source = url.searchParams.get("source") === "studio" ? "studio" : "main";
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") ?? "";
  if (!/^[A-Za-z0-9_-]{10,512}$/.test(fileId)) return json({ error: "Invalid file reference" }, 400);

  const tokenName = source === "studio" ? "STUDIO_TELEGRAM_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN";
  const token = Deno.env.get(tokenName);
  if (!token) return json({ error: "Media service unavailable" }, 503);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) {
    return json({ error: "Media link expired" }, 403);
  }
  const expected = await signMediaReference(token, source, fileId, expires);
  if (!constantTimeEqual(signature, expected)) return json({ error: "Invalid media link" }, 403);

  try {
    const metadataResponse = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    );
    const metadata = await metadataResponse.json();
    const filePath = metadata?.result?.file_path;
    if (!metadataResponse.ok || !metadata?.ok || typeof filePath !== "string") {
      return json({ error: "Media not found" }, 404);
    }

    const upstreamHeaders = new Headers();
    const range = req.headers.get("Range");
    if (range) upstreamHeaders.set("Range", range);
    const mediaResponse = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
      method: req.method,
      headers: upstreamHeaders,
    });
    if (!mediaResponse.ok && mediaResponse.status !== 206) return json({ error: "Media unavailable" }, 502);

    const headers = new Headers(corsHeaders);
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = mediaResponse.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "private, max-age=300");
    return new Response(req.method === "HEAD" ? null : mediaResponse.body, {
      status: mediaResponse.status,
      headers,
    });
  } catch {
    return json({ error: "Media service unavailable" }, 502);
  }
});

async function signMediaReference(secret: string, source: string, fileId: string, expires: number) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${source}:${fileId}:${expires}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}