import { PlayCircle } from "lucide-react";

export default function Reels() {
  return (
    <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <PlayCircle className="h-8 w-8" /> Reels
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Vertical TikTok-style reels with admin uploads and forced ad slots every few swipes. Coming soon.
        </p>
      </header>
      <section className="glass rounded-2xl p-8 border border-border/40 text-center text-muted-foreground">
        <p>Vertical reels player is being prepared.</p>
      </section>
    </div>
  );
}