import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Check } from "lucide-react";
import { Label } from "@/components/ui/label";

export type PickerItem = { id: string; title: string; poster_url?: string | null };

/** Internal search bar for the platform's own catalog — replaces external TMDB lookups. */
export function MovieSearchPicker({
  label = "Link to movie",
  items,
  value,
  onChange,
  emptyHint = "No matches in your catalog",
  placeholder = "Search your movies by title…",
}: {
  label?: string;
  items: PickerItem[];
  value: string;
  onChange: (id: string, item?: PickerItem) => void;
  emptyHint?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const selected = items.find((i) => i.id === value) || null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items.filter((i) => i.title.toLowerCase().includes(s)).slice(0, 12);
  }, [items, q]);

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center gap-3 glass rounded-xl p-2">
          <div className="w-10 h-14 bg-black/40 rounded overflow-hidden">
            {selected.poster_url && <img src={selected.poster_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{selected.title}</div>
            <div className="text-[11px] text-muted-foreground truncate">Local ID · {selected.id.slice(0, 8)}…</div>
          </div>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange("")}>
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-9 bg-secondary/40" />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border/40 divide-y divide-border/30">
            {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground">{emptyHint}</div>}
            {filtered.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => { onChange(m.id, m); setQ(""); }}
                className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-secondary/60 transition"
              >
                <div className="w-8 h-11 bg-black/40 rounded overflow-hidden shrink-0">
                  {m.poster_url && <img src={m.poster_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{m.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{m.id}</div>
                </div>
                <Check className="h-4 w-4 text-primary opacity-0" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}