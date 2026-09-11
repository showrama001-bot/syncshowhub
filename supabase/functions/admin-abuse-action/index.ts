import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify caller and admin role
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admins only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { report_id, action, device_fingerprint } = body as {
      report_id: string;
      action: "delete_movie" | "suspend_3d" | "permanent_ban" | "dismiss";
      device_fingerprint?: string;
    };
    if (!report_id || !action) {
      return new Response(JSON.stringify({ error: "report_id and action required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: report, error: repErr } = await admin
      .from("movie_reports").select("*").eq("id", report_id).maybeSingle();
    if (repErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: movie } = await admin
      .from("movies").select("id, title, created_by").eq("id", report.movie_id).maybeSingle();
    const uploaderId = movie?.created_by ?? null;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const logViolation = async (action_taken: string) => {
      if (!uploaderId) return;
      await admin.from("user_violations").insert({
        user_id: uploaderId,
        movie_id: report.movie_id,
        report_id: report.id,
        action_taken,
        created_by: callerId,
      });
    };

    if (action === "delete_movie") {
      await admin.from("movies").delete().eq("id", report.movie_id);
      await logViolation("movie_deleted");
    } else if (action === "suspend_3d") {
      if (uploaderId) {
        const until = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const { error: suspensionError } = await admin.from("profiles").update({ suspended_until: until }).eq("id", uploaderId);
        if (suspensionError) throw suspensionError;
        const { error: banError } = await admin.auth.admin.updateUserById(uploaderId, { ban_duration: "72h" });
        if (banError) throw banError;
      }
      await logViolation("suspended_3d");
    } else if (action === "permanent_ban") {
      if (uploaderId) {
        await admin.from("profiles").update({ permanent_banned: true, is_banned: true }).eq("id", uploaderId);
        try { await admin.auth.admin.updateUserById(uploaderId, { ban_duration: "876000h" }); } catch (_) {}
        if (device_fingerprint) {
          await admin.from("device_bans").upsert({
            user_id: uploaderId,
            device_fingerprint,
            ip_address: ip,
            created_by: callerId,
          }, { onConflict: "device_fingerprint" });
        }
      }
      await logViolation("permanent_ban");
    }

    const newStatus = action === "dismiss" ? "dismissed" : "resolved";
    await admin.from("movie_reports").update({
      status: newStatus,
      resolved_at: new Date().toISOString(),
      resolved_by: callerId,
    }).eq("id", report_id);

    let violationCount = 0;
    if (uploaderId) {
      const { count } = await admin
        .from("user_violations").select("id", { count: "exact", head: true }).eq("user_id", uploaderId);
      violationCount = count ?? 0;
    }

    return new Response(JSON.stringify({ ok: true, violationCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});