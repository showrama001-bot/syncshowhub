import { useEffect, useRef } from "react";

/**
 * Renders an arbitrary HTML/JS ad snippet (Adsterra, PropellerAds, VAST tags, iframes).
 * <script> tags inside the snippet are extracted and re-injected so the browser actually executes them.
 */
export const ScriptSlot = ({ html, className }: { html: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !html?.trim()) return;
    host.innerHTML = html;
    // Re-execute <script> tags
    host.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const attr of Array.from(old.attributes)) s.setAttribute(attr.name, attr.value);
      s.text = old.text;
      old.parentNode?.replaceChild(s, old);
    });
    return () => {
      if (host) host.innerHTML = "";
    };
  }, [html]);

  if (!html?.trim()) return null;
  return <div ref={ref} className={className} />;
};

/**
 * Mounts global sitewide ad scripts (Popunder, Social Bar, Direct Link loaders)
 * once at app root. Re-runs if the script content changes.
 */
export const GlobalScriptInjector = ({ html }: { html: string }) => {
  useEffect(() => {
    if (!html?.trim()) return;
    const container = document.createElement("div");
    container.setAttribute("data-syncshow-ads", "global");
    container.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;";
    container.innerHTML = html;
    document.body.appendChild(container);
    container.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const attr of Array.from(old.attributes)) s.setAttribute(attr.name, attr.value);
      s.text = old.text;
      old.parentNode?.replaceChild(s, old);
    });
    return () => {
      container.remove();
    };
  }, [html]);
  return null;
};