import { Newspaper } from "lucide-react";

export default function Accueil() {
  return (
    <div className="pt-20 px-4 md:px-8 max-w-3xl mx-auto pb-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-5xl tracking-wider neon-text flex items-center gap-3">
          <Newspaper className="h-8 w-8" /> Accueil
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Social feed — text & image posts, likes, comments, shares. Coming online soon.
        </p>
      </header>
      <section className="glass rounded-2xl p-8 border border-border/40 text-center text-muted-foreground">
        <p>The social feed is being prepared. Posts, reactions, and in-feed ad slots will appear here.</p>
      </section>
    </div>
  );
}