import { useCallback, useEffect, useState } from "react";

/**
 * localStorage-backed preference hook. Reads once, writes on change,
 * and syncs across tabs via the `storage` event.
 */
export function useLocalPref<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const read = (): T => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  };
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue == null) return;
      try { setValue(JSON.parse(e.newValue) as T); } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof v === "function" ? (v as (p: T) => T)(prev) : v));
  }, []);

  return [value, update];
}
