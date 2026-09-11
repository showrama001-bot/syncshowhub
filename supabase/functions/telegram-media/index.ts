import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!authHeader.startsWith("Bearer ") || !supabaseUrl || !anonKey) {
    return json({ error: "Authentication required" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return json({ error: "Authentication required" }, 401);

  const url = new URL(req.url);
  const fileId = url.searchParams.get("file_id")?.trim() ?? "";
  const source = url.searchParams.get("source") === "studio" ? "studio" : "main";
  if (!/^[A-Za-z0-9_-]{10,512}$/.test(fileId)) return json({ error: "Invalid file reference" }, 400);

  const tokenName = source === "studio" ? "STUDIO_TELEGRAM_BOT_TOKEN" : "TELEGRAM_BOT_TOKEN";
  const token = Deno.env.get(tokenName);
  if (!token) return json({ error: "Media service unavailable" }, 503);

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