import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StorageMode = "telegram" | "bunny";
const KEY = "storage_mode";
const DEFAULT: StorageMode = "telegram";

export function useStorageMode() {
  const [mode, setMode] = useState<StorageMode>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("platform_settings" as any)
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    const v = (data as any)?.value;
    if (v === "telegram" || v === "bunny") setMode(v);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`platform_settings_changes_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings", filter: `key=eq.${KEY}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const update = useCallback(async (next: StorageMode) => {
    setMode(next);
    const { error } = await supabase
      .from("platform_settings" as any)
      .upsert({ key: KEY, value: next as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  }, []);

  return { mode, setMode: update, loading };
}