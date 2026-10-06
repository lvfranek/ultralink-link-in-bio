import { describe, expect, it } from "vitest";
import type { Page, PageLink, PageSocial } from "@/lib/supabase/types";
import { PRESETS, resolveTheme } from "@/lib/config/theme";
import {
  draftFromPage,
  draftProblems,
  presetDraft,
  previewData,
  themeFromDraft,
  tidyUrl,
  toHex,
  urlError,
} from "./draft";

const page = (overrides: Partial<Page> = {}): Page =>
  ({
    id: "p1",
    owner_id: "u1",
    slug: "mia",
    title: "Mia",
    bio: "Hi",
    avatar_url: null,
    avatar_style: "circle",
    active_badge: false,
    template: "classic",
    theme: { preset: "custom", pageBg: { type: "color", value: "#1E1E1E", overlay: 0 } },
    age_gate_enabled: false,
    blocked_countries: [],
    win_back: { enabled: false, headline: "", url: "" },
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as Page;

const link = (overrides: Partial<PageLink>): PageLink =>
  ({
    id: "l1",
    page_id: "p1",
    label: "Shop",
    url: "https://shop.com",
    position: 0,
    layout: "classic",
    is_active: true,
    icon: null,
    is_adult: false,
    fill_type: "color",
    fill_value: "#FF0000",
    text_color: "#FFFFFF",
    corner: "pill",
    animation: "none",
    item_type: "button",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as PageLink;

const socials: PageSocial[] = [];

describe("toHex", () => {
  it("normalises colours for the native picker", () => {
    expect(toHex("#ABC", "#000000")).toBe("#aabbcc");
    expect(toHex("#FF5A4E", "#000000")).toBe("#ff5a4e");
    expect(toHex("linear-gradient(135deg, #06AEEF 0%, #A78BFA 100%)", "#000000")).toBe("#a78bfa");
    expect(toHex("not a colour", "#123456")).toBe("#123456");
  });
});

describe("draftFromPage", () => {
  it("uses the first button's style for every button", () => {
    const d = draftFromPage(
      page(),
      [
        link({ id: "a", fill_value: "#FF0000", corner: "rounded" }),
        link({ id: "b", fill_value: "#00FF00", corner: "square" }),
      ],
      socials,
    );
    expect(d.colors.button).toBe("#ff0000");
    expect(d.corner).toBe("rounded");
  });

  it("turns a gradient background into its end colour", () => {
    const d = draftFromPage(
      page({
        theme: {
          preset: "custom",
          pageBg: { type: "gradient", value: "linear-gradient(#111111, #222222)", overlay: 0 },
        },
      }),
      [],
      socials,
    );
    expect(d.colors.background).toBe("#222222");
  });

  it("replaces a background image with the preset's colour", () => {
    const d = draftFromPage(
      page({ theme: { preset: "editorial", pageBg: { type: "image", value: "https://x.com/bg.jpg", overlay: 0.2 } } }),
      [],
      socials,
    );
    expect(d.colors.background).toBe("#f3eee6");
  });

  it("brings back a saved theme exactly: gradient, grain, button look and both fonts", () => {
    const design = presetDraft("noir");
    const saved = themeFromDraft({ ...draftFromPage(page(), [], socials), ...design });
    const d = draftFromPage(
      page({ theme: saved }),
      [link({ fill_value: PRESETS.noir.linkStyle.fillValue, text_color: "#ffffff", corner: "more" })],
      socials,
    );
    expect(d.preset).toBe("noir");
    expect(d.bg).toEqual({ kind: "glow", to: "#5b3df5" });
    expect(d.colors.background).toBe("#0b0b0f");
    expect(d.buttonVariant).toBe("glass");
    expect([d.titleFont, d.bodyFont]).toEqual(["space-grotesk", "inter"]);
    expect(resolveTheme(saved).pageBg.type).toBe("gradient");
  });

  it("shows pages on a removed preset as custom, with their own colours", () => {
    const d = draftFromPage(
      page({ theme: { preset: "glacier", pageBg: { type: "color", value: "#FFFFFF", overlay: 0 } } }),
      [link({ fill_value: "#06AEEF" })],
      socials,
    );
    expect(d.preset).toBe("custom");
    expect(d.colors.button).toBe("#06aeef");
    expect(d.buttonVariant).toBe("solid");
    expect(d.bg.kind).toBe("solid");
  });

  it("keeps the Win-Back 18+ setting and the page age gate", () => {
    const d = draftFromPage(
      page({
        age_gate_enabled: true,
        win_back: { enabled: true, headline: "Wait", url: "https://a.com", age_gate: true },
      }),
      [],
      socials,
    );
    expect(d.ageGate).toBe(true);
    expect(d.winBack).toEqual({ enabled: true, headline: "Wait", url: "https://a.com", ageGate: true });
  });
});

describe("previewData", () => {
  it("shows only visible links, with headings in the theme's name colour", () => {
    const d = draftFromPage(
      page(),
      [
        link({ id: "a" }),
        link({ id: "h", item_type: "heading", text_color: "#00FF00" }),
        link({ id: "off", is_active: false }),
      ],
      socials,
    );
    const pv = previewData(d, "mia", "p1", true);
    expect(pv.links.map((l) => l.id)).toEqual(["a", "h"]);
    expect(pv.links[1].text_color).toBe("");
  });
});

describe("URL checks", () => {
  it("flags what isn't a web address and completes bare domains", () => {
    expect(urlError("not a url")).not.toBeNull();
    expect(urlError("ftp://files.com")).toMatch(/https/);
    expect(urlError("youtube.com/@me")).toBeNull();
    expect(tidyUrl("youtube.com/@me")).toBe("https://youtube.com/@me");
    expect(tidyUrl("not a url")).toBe("not a url");
  });

  it("accepts mailto: for the Email icon only", () => {
    expect(urlError("mailto:me@example.com", { allowMailto: true })).toBeNull();
    expect(urlError("mailto:me@example.com")).not.toBeNull();
  });
});

describe("draftProblems", () => {
  it("lists what blocks saving", () => {
    const d = draftFromPage(page({ title: "" }), [link({ label: "", url: "nope" })], socials);
    d.winBack = { enabled: true, headline: "", url: "", ageGate: false };
    expect(draftProblems(d)).toEqual([
      "Add a name",
      "Label 1 button",
      "Fix 1 button",
      "Add a Win-Back headline",
      "Fix your Win-Back link",
    ]);
  });
});
