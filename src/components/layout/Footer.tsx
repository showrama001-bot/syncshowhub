import { Link } from "react-router-dom";

export const Footer = () => {
  return (
    <footer className="mt-16 border-t border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="font-display tracking-widest neon-text">SYNCSHOW</div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link to="/terms" className="hover:text-primary transition">Terms of Service</Link>
          <Link to="/terms#privacy" className="hover:text-primary transition">Privacy Policy</Link>
        </nav>
        <div className="opacity-70">© {new Date().getFullYear()} SyncShow. All rights reserved.</div>
      </div>
    </footer>
  );
};