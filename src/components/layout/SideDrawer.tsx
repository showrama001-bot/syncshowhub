import { NavLink } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  User,
  Film,
  Tv,
  Tv2,
  Trophy,
  MessageSquare,
  Users,
  Shield,
  LogOut,
  Bookmark,
  Upload,
  Sparkles,
  Home as HomeIcon,
  Users2,
  Newspaper,
  PlayCircle,
  Clapperboard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDisplayIdentity } from "@/hooks/useDisplayIdentity";
import { useState } from "react";

const items = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/accueil", label: "Accueil (Social Feed)", icon: Newspaper },
  { to: "/reels", label: "Reels", icon: PlayCircle },
  { to: "/trailers", label: "Trailers", icon: Clapperboard },
  { to: "/rooms", label: "Shared Rooms", icon: Users },
  { to: "/friends", label: "Friends & Messages", icon: MessageSquare },
  { to: "/discover", label: "Discover Friends", icon: Sparkles },
  { to: "/community", label: "Movie Community 👥", icon: Users2 },
  { to: "/upload-gateway", label: "Upload Gateway", icon: Upload },
  { to: "/movies", label: "Movies", icon: Film },
  { to: "/series", label: "Series", icon: Tv2 },
  { to: "/suggested", label: "Suggested", icon: Sparkles },
  { to: "/watchlist", label: "My Watchlist", icon: Bookmark },
  { to: "/tv", label: "TV", icon: Tv },
  { to: "/sports", label: "Sports", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
];

export const SideDrawer = () => {
  const { signOut, user } = useAuth();
  const { displayName, handle } = useDisplayIdentity();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50 glass rounded-full hover:neon-border transition-all"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="bg-background/80 backdrop-blur-2xl border-border/50 w-72 p-0"
      >
        <SheetHeader className="p-6 pb-3 border-b border-border/40">
          <SheetTitle className="font-display text-2xl tracking-widest neon-text">
            SYNCSHOW
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate">
            {user ? <>{displayName} <span className="opacity-70">@{handle}</span></> : null}
          </p>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4 overflow-y-auto scrollbar-hide max-h-[calc(100vh-9rem)]">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary shadow-neon"
                    : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <it.icon className="h-5 w-5" />
              <span className="font-medium">{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="ghost"
            onClick={() => signOut()}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-primary"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};