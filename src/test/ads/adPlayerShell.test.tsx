import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DEFAULT_AD_CONFIG, AdConfig } from "@/lib/ads";

const cfg: AdConfig = {
  ...DEFAULT_AD_CONFIG,
  preroll_url: "https://cdn.test/pre.mp4",
  skip_seconds: 0,
  break_enabled: true,
  break_trigger_seconds: 10,
  hook_image_url: "https://cdn.test/hook.jpg",
  hook_duration_seconds: 1,
  break_queue: [{ id: "a1", url: "https://cdn.test/ad1.mp4" }],
};

vi.mock("@/components/ads/AdsProvider", () => ({
  useAds: () => ({ config: cfg, enabled: true, refresh: async () => {} }),
}));

import { AdPlayerShell } from "@/components/ads/AdVideoPlayer";

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
});

describe("AdPlayerShell timeline", () => {
  it("shows a pre-roll overlay and holds the content video muted", async () => {
    render(
      <AdPlayerShell>
        <video data-testid="content" src="https://cdn.test/movie.mp4" />
      </AdPlayerShell>,
    );
    await act(async () => { await Promise.resolve(); });
    const content = screen.getByTestId("content") as HTMLVideoElement;
    expect(document.querySelector('video[src="https://cdn.test/pre.mp4"]')).toBeTruthy();
    expect(content.muted).toBe(true);
  });

  it("runs hook -> ad queue -> resume when the break triggers", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <AdPlayerShell>
        <video data-testid="content2" src="https://cdn.test/movie.mp4" />
      </AdPlayerShell>,
    );
    const pre = container.querySelector('video[src="https://cdn.test/pre.mp4"]') as HTMLVideoElement;
    await act(async () => { pre.dispatchEvent(new Event("ended")); vi.advanceTimersByTime(10); });

    const content = container.querySelector('[data-testid="content2"]') as HTMLVideoElement;
    Object.defineProperty(content, "currentTime", { configurable: true, writable: true, value: 11 });
    await act(async () => { content.dispatchEvent(new Event("timeupdate")); });
    expect(container.querySelector('img[src="https://cdn.test/hook.jpg"]')).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(1500); });
    const ad = container.querySelector('video[src="https://cdn.test/ad1.mp4"]') as HTMLVideoElement;
    expect(ad).toBeTruthy();

    await act(async () => { ad.dispatchEvent(new Event("ended")); vi.advanceTimersByTime(50); });
    expect(container.querySelector('video[src="https://cdn.test/ad1.mp4"]')).toBeNull();
    // content audio is restored (no lingering mute) after the break resumes
    expect(content.muted).toBe(false);
    vi.useRealTimers();
  });
});
