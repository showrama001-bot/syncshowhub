import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SideDrawer } from "./SideDrawer";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HeaderBanner } from "@/components/ads/HeaderBanner";
import { PopupAdOverlay } from "@/components/ads/PopupAdOverlay";
import { AntiAdblock } from "@/components/ads/AntiAdblock";
import { GlobalScriptInjector } from "@/components/ads/ScriptSlot";
import { useAds } from "@/components/ads/AdsProvider";
import { Footer } from "./Footer";

export const AppShell = () => {
  const { user, loading } = useAuth();
  const { enabled, settings } = useAds();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="font-display text-xl neon-text animate-pulse">SYNCSHOW</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <SideDrawer />
      <NotificationBell />
      <HeaderBanner />
      <main className="min-h-screen">
        <Outlet />
      </main>
      <Footer />
      <PopupAdOverlay />
      <AntiAdblock />
      {enabled && settings.global_scripts ? <GlobalScriptInjector html={settings.global_scripts} /> : null}
    </div>
  );
};