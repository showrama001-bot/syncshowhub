import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import AdminLogin from "./pages/AdminLogin";
import Redirect from "./pages/Redirect";
import Cooldown from "./pages/Cooldown";
import OAuthConsent from "./pages/OAuthConsent";
import Terms from "./pages/Terms";
import Home from "./pages/app/Home";
import Movies from "./pages/app/Movies";
import Series from "./pages/app/Series";
import Suggested from "./pages/app/Suggested";
import TV from "./pages/app/TV";
import Sports from "./pages/app/Sports";
import Profile from "./pages/app/Profile";
import Watchlist from "./pages/app/Watchlist";
import Contribute from "./pages/app/Contribute";
import Friends from "./pages/app/Friends";
import Accueil from "./pages/app/Accueil";
import NotFound from "./pages/NotFound";
import { AdsProvider } from "@/components/ads/AdsProvider";
import { installAntiTheft } from "@/lib/antiTheft";
import { installMonitoring } from "@/lib/monitoring";
import { MiniPlayerProvider } from "@/components/miniplayer/MiniPlayerProvider";

// Lazy-load the heavy player bundle — only fetched when user clicks Play.
const Player = lazy(() => import("./pages/app/Player"));
const Watch = lazy(() => import("./pages/app/Watch"));
const Rooms = lazy(() => import("./pages/app/Rooms"));
const DMs = lazy(() => import("./pages/app/DMs"));
const Admin = lazy(() => import("./pages/app/Admin"));
const UploadMovie = lazy(() => import("./pages/app/UploadMovie"));
const UploadShare = lazy(() => import("./pages/app/UploadShare"));
const Reels = lazy(() => import("./pages/app/Reels"));
const Trailers = lazy(() => import("./pages/app/Trailers"));
const Studio = lazy(() => import("./pages/app/Studio"));
const Discover = lazy(() => import("./pages/app/Discover"));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>
);
const lazyRoute = (el: React.ReactNode) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    installAntiTheft();
    installMonitoring();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AdsProvider>
          <MiniPlayerProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/redirect" element={<Redirect />} />
            <Route path="/cooldown" element={<Cooldown />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Navigate to="/terms#privacy" replace />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/series" element={<Series />} />
              <Route path="/suggested" element={<Suggested />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/tv" element={<TV />} />
              <Route path="/sports" element={<Sports />} />
              <Route path="/rooms" element={lazyRoute(<Rooms />)} />
              <Route path="/watch-together" element={<Navigate to="/rooms" replace />} />
              <Route path="/watch" element={<Navigate to="/rooms" replace />} />
              <Route path="/watch/:roomId" element={lazyRoute(<Watch />)} />
              <Route path="/watch/room/:roomId" element={lazyRoute(<Watch />)} />
              <Route path="/dms" element={lazyRoute(<DMs />)} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/discover" element={lazyRoute(<Discover />)} />
              <Route path="/community" element={lazyRoute(<Discover />)} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/upload-movie" element={lazyRoute(<UploadMovie />)} />
              <Route path="/upload-gateway" element={lazyRoute(<UploadMovie />)} />
              <Route path="/upload-share" element={lazyRoute(<UploadShare />)} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/accueil" element={<Accueil />} />
              <Route path="/reels" element={lazyRoute(<Reels />)} />
              <Route path="/trailers" element={lazyRoute(<Trailers />)} />
              <Route path="/studio" element={lazyRoute(<Studio />)} />
              <Route path="/live-stream" element={lazyRoute(<Studio />)} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard/hub-secure-2026" replace />} />
              <Route path="/admin/dashboard" element={<Navigate to="/admin/dashboard/hub-secure-2026" replace />} />
              <Route path="/admin/dashboard/hub-secure-2026" element={lazyRoute(<Admin />)} />
              <Route
                path="/play/:kind/:id"
                element={
                  <Suspense
                    fallback={
                      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
                        Loading player…
                      </div>
                    }
                  >
                    <Player />
                  </Suspense>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </MiniPlayerProvider>
          </AdsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
