import { describe, it, expect } from "vitest";
import { resolveTheme, DEFAULT_THEME, PRESETS, bgCss, buttonLook, gradientEndColor } from "./theme";

describe("resolveTheme", () => {
  it("returns the default theme for missing or empty values", () => {
    expect(resolveTheme(null)).toEqual(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toEqual(DEFAULT_THEME);
    expect(resolveTheme({})).toEqual(DEFAULT_THEME);
  });

  it("keeps valid presets and 'custom'", () => {
    expect(resolveTheme({ preset: "noir" }).preset).toBe("noir");
    expect(resolveTheme({ preset: "custom" }).preset).toBe("custom");
  });

  it("turns removed presets into 'custom' so those pages keep their colours", () => {
    for (const old of ["glacier", "sunset", "mint", "lilac", "max_conversion", "toString"]) {
      expect(resolveTheme({ preset: old }).preset).toBe("custom");
    }
  });

  it("gives older themes a solid button look and no grain", () => {
    const theme = resolveTheme({ preset: "custom", pageBg: { type: "color", value: "#000000" } });
    expect(theme.buttonVariant).toBe("solid");
    expect(theme.texture).toBe("none");
    expect(resolveTheme({ buttonVariant: "sparkly" }).buttonVariant).toBe("solid");
  });

  it("keeps an editor-made gradient, and drops a broken one", () => {
    const gradient = { style: "glow", from: "#000000", to: "#5b3df5" };
    const ok = resolveTheme({ pageBg: { type: "gradient", value: "x", gradient } });
    expect(ok.pageBg.gradient).toEqual(gradient);
    const broken = resolveTheme({ pageBg: { type: "gradient", value: "x", gradient: { style: "wavy" } } });
    expect(broken.pageBg.gradient).toBeUndefined();
  });

  it("round-trips every preset unchanged", () => {
    for (const p of Object.values(PRESETS)) {
      expect(resolveTheme(p.theme as unknown as Record<string, unknown>)).toMatchObject(p.theme);
    }
  });

  it("fills in missing fields from the defaults", () => {
    const theme = resolveTheme({ pageBg: { type: "color", value: "#000000" } });
    expect(theme.pageBg.value).toBe("#000000");
    expect(theme.pageBg.overlay).toBe(DEFAULT_THEME.pageBg.overlay);
    expect(theme.fonts).toEqual(DEFAULT_THEME.fonts);
    expect(theme.colors).toEqual(DEFAULT_THEME.colors);
  });

  it("ignores wrongly-typed numbers instead of crashing", () => {
    const theme = resolveTheme({ pageBg: { type: "color", value: "#000", overlay: "50%", blur: "lots" } });
    expect(theme.pageBg.overlay).toBe(DEFAULT_THEME.pageBg.overlay);
    expect(theme.pageBg.blur).toBe(0);
  });

  it("drops fields from older theme versions", () => {
    const theme = resolveTheme({ preset: "noir", button: { corner: "pill" }, animation: "bounce" });
    expect(theme).not.toHaveProperty("button");
    expect(theme).not.toHaveProperty("animation");
  });
});

describe("bgCss", () => {
  it("builds a top-to-bottom gradient or a glow over the base colour", () => {
    expect(bgCss({ style: "linear", from: "#111111", to: "#222222" })).toBe(
      "linear-gradient(160deg, #111111 0%, #222222 100%)",
    );
    const glow = bgCss({ style: "glow", from: "#0b0b0f", to: "#5b3df5" });
    expect(glow).toMatch(/^radial-gradient\(/);
    // The base colour is what contrast checks (footer panel) are judged against
    expect(gradientEndColor(glow)).toBe("#0b0b0f");
  });
});

describe("buttonLook", () => {
  it("passes colours and corners to the variant's class", () => {
    const look = buttonLook("hard", { fillValue: "#ffffff", textColor: "#0a0a0a", corner: "pill" });
    expect(look.className).toBe("ul-btn ul-btn--hard");
    expect(look.style).toMatchObject({ "--btn-fill": "#ffffff", "--btn-text": "#0a0a0a", borderRadius: "9999px" });
  });
});
