import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sanitizeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80) || "video";
  const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : ".mp4";
  return `${Date.now()}_${base}${ext}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BUNNY_KEY = Deno.env.get("BUNNY_ACCESS_KEY");
    const BUNNY_ZONE = Deno.env.get("BUNNY_STORAGE_ZONE") || "syncshow";
    const BUNNY_PULL = Deno.env.get("BUNNY_PULL_ZONE") || "https://syncshow.b-cdn.net";

    if (!BUNNY_KEY) {
      return new Response(JSON.stringify({ error: "Bunny not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ error: "Admins only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data with 'file'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fileName = sanitizeFileName(file.name || "video.mp4");
    const uploadUrl = `https://storage.bunnycdn.com/${BUNNY_ZONE}/${fileName}`;
    const buf = await file.arrayBuffer();
    const r = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_KEY,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: buf,
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: `Bunny upload failed (${r.status})` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const url = `${BUNNY_PULL}/${fileName}`;
    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});