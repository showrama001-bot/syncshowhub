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
import Home from "./pages/app/Home";
import Movies from "./pages/app/Movies";
import Series from "./pages/app/Series";
import Suggested from "./pages/app/Suggested";
import TV from "./pages/app/TV";
import Sports from "./pages/app/Sports";
import Watch from "./pages/app/Watch";
import Rooms from "./pages/app/Rooms";
import DMs from "./pages/app/DMs";
import Profile from "./pages/app/Profile";
import Admin from "./pages/app/Admin";
import Watchlist from "./pages/app/Watchlist";
import UploadMovie from "./pages/app/UploadMovie";
import UploadShare from "./pages/app/UploadShare";
import Contribute from "./pages/app/Contribute";
import Friends from "./pages/app/Friends";
import NotFound from "./pages/NotFound";
import { AdsProvider } from "@/components/ads/AdsProvider";
import { installAntiTheft } from "@/lib/antiTheft";

// Lazy-load the heavy player bundle — only fetched when user clicks Play.
const Player = lazy(() => import("./pages/app/Player"));

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    installAntiTheft();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AdsProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/redirect" element={<Redirect />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/series" element={<Series />} />
              <Route path="/suggested" element={<Suggested />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/tv" element={<TV />} />
              <Route path="/sports" element={<Sports />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/watch-together" element={<Navigate to="/rooms" replace />} />
              <Route path="/watch" element={<Navigate to="/rooms" replace />} />
              <Route path="/watch/:roomId" element={<Watch />} />
              <Route path="/dms" element={<DMs />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/upload-movie" element={<UploadMovie />} />
              <Route path="/upload-share" element={<UploadShare />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<Admin />} />
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
          </AdsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
