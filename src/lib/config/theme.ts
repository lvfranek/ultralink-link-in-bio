import type { CSSProperties } from "react";

// ─── PAGE-LEVEL THEME ─────────────────────────────────────────────────────────

/** "linear" runs top to bottom; "glow" is a soft light from the top over the base colour */
export type GradientStyle = "linear" | "glow";
export type ButtonVariant = "solid" | "soft" | "glass" | "outline" | "hard";

export type Theme = {
  preset: "noir" | "peach" | "editorial" | "pop" | "custom";
  pageBg: {
    type: "color" | "gradient" | "image";
    /** Ready-to-use CSS background */
    value: string;
    overlay: number;
    blur?: number;
    /** What a gradient was built from, so the editor can show it again */
    gradient?: { style: GradientStyle; from: string; to: string };
    // Cache last-used values per type so mode-switching preserves them.
    lastColor?: string;
    lastGradient?: string;
    lastImage?: string;
  };
  /** Fine film grain over the background */
  texture: "none" | "grain";
  /** How every button on the page is drawn; colours come from the button rows */
  buttonVariant: ButtonVariant;
  fonts: { title: string; body: string };
  colors: {
    name: string;
    handle: string;
    icons: string;
  };
};

// ─── PER-LINK STYLE ───────────────────────────────────────────────────────────

export type LinkStyle = {
  fillType: "color" | "gradient";
  fillValue: string;
  textColor: string;
  corner: "square" | "rounded" | "more" | "pill";
  animation: "none" | "bounce" | "shake" | "pulse";
};

// ─── FONTS ────────────────────────────────────────────────────────────────────

type FontOption = {
  id: string;
  label: string;
  variable: string;
  /** Display faces need a bigger size (and Bebas has no bold) to work as the page name */
  title?: CSSProperties;
};

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: "inter", label: "Inter", variable: "--font-inter" },
  { id: "playfair", label: "Playfair Display", variable: "--font-playfair", title: { fontSize: "1.625rem" } },
  { id: "poppins", label: "Poppins", variable: "--font-poppins" },
  { id: "montserrat", label: "Montserrat", variable: "--font-montserrat" },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    variable: "--font-space-grotesk",
    title: { letterSpacing: "-0.02em" },
  },
  { id: "dm-sans", label: "DM Sans", variable: "--font-dm-sans" },
  {
    id: "cormorant",
    label: "Cormorant",
    variable: "--font-cormorant",
    title: { fontSize: "1.875rem", fontWeight: 600 },
  },
  {
    id: "bebas",
    label: "Bebas Neue",
    variable: "--font-bebas",
    title: { fontSize: "2.5rem", fontWeight: 400, lineHeight: 1, letterSpacing: "0.01em" },
  },
];

export function fontVar(id: string): string {
  const f = FONT_OPTIONS.find((f) => f.id === id);
  return f ? `var(${f.variable}), system-ui, sans-serif` : "var(--font-inter), system-ui, sans-serif";
}

/** Size and weight tweaks for the page name in this font */
export function titleStyle(id: string): CSSProperties {
  return FONT_OPTIONS.find((f) => f.id === id)?.title ?? {};
}

// ─── BUTTON / LINK CORNER OPTIONS ────────────────────────────────────────────

export const BUTTON_CORNERS = [
  { id: "square" as const, label: "Square", radius: "0px" },
  { id: "rounded" as const, label: "Rounded", radius: "0.5rem" },
  { id: "more" as const, label: "More", radius: "1rem" },
  { id: "pill" as const, label: "Pill", radius: "9999px" },
];

export const ANIMATIONS = [
  { id: "none" as const, label: "None" },
  { id: "bounce" as const, label: "Bounce" },
  { id: "shake" as const, label: "Shake" },
  { id: "pulse" as const, label: "Pulse" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function cornerRadius(corner: LinkStyle["corner"]): string {
  return BUTTON_CORNERS.find((c) => c.id === corner)?.radius ?? "0.5rem";
}

export function animClass(anim: LinkStyle["animation"]): string {
  return anim === "none" ? "" : `theme-anim-${anim}`;
}

export const BUTTON_VARIANTS: { id: ButtonVariant; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "soft", label: "Soft" },
  { id: "glass", label: "Glass" },
  { id: "outline", label: "Outline" },
  { id: "hard", label: "Hard shadow" },
];

/**
 * Class + inline style for a button in the given variant. The look itself lives
 * in globals.css (.ul-btn--*) and reads --btn-fill / --btn-text, so hover and
 * press states work there too.
 */
export function buttonLook(
  variant: ButtonVariant,
  ls: Pick<LinkStyle, "fillValue" | "textColor" | "corner">,
): { className: string; style: CSSProperties } {
  return {
    className: `ul-btn ul-btn--${variant}`,
    style: {
      "--btn-fill": ls.fillValue,
      "--btn-text": ls.textColor,
      // Inline so link colour rules around the button (e.g. the dashboard's `.root a`) can't win
      color: ls.textColor,
      borderRadius: cornerRadius(ls.corner),
    } as CSSProperties,
  };
}

/** CSS background for a gradient built in the editor */
export function bgCss({ style, from, to }: { style: GradientStyle; from: string; to: string }): string {
  return style === "glow"
    ? `radial-gradient(130% 75% at 50% -10%, ${to} 0%, transparent 70%), radial-gradient(90% 55% at 100% 105%, color-mix(in srgb, ${to} 40%, transparent) 0%, transparent 70%), ${from}`
    : `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;
}

/** Extract the terminal color from a CSS gradient string (best-effort). */
export function gradientEndColor(gradientValue: string): string {
  const matches = gradientValue.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
  if (matches && matches.length > 0) return matches[matches.length - 1];
  return "#0A0A0B";
}

// ─── DEFAULT LINK STYLE ───────────────────────────────────────────────────────

export const DEFAULT_LINK_STYLE: LinkStyle = {
  fillType: "color",
  fillValue: "#06AEEF",
  textColor: "#FFFFFF",
  corner: "pill",
  animation: "none",
};

// ─── DEFAULT THEME ────────────────────────────────────────────────────────────

/** Fills in whatever a stored theme is missing; matches how pages looked before themes had more to them */
export const DEFAULT_THEME: Theme = {
  preset: "custom",
  pageBg: { type: "color", value: "#FFFFFF", overlay: 0 },
  texture: "none",
  buttonVariant: "solid",
  fonts: { title: "inter", body: "inter" },
  colors: { name: "#0A0A0A", handle: "#5A5A5A", icons: "#0A0A0A" },
};

// ─── PRESETS ──────────────────────────────────────────────────────────────────

export type PresetKey = Exclude<Theme["preset"], "custom">;

export type PresetDef = {
  theme: Theme;
  linkStyle: LinkStyle;
  label: string;
  tagline: string;
};

function gradientBg(style: GradientStyle, from: string, to: string): Theme["pageBg"] {
  const gradient = { style, from, to };
  return { type: "gradient", value: bgCss(gradient), overlay: 0, gradient };
}

export const PRESETS: Record<PresetKey, PresetDef> = {
  noir: {
    label: "Noir",
    tagline: "Dark & glassy",
    theme: {
      preset: "noir",
      pageBg: gradientBg("glow", "#0b0b0f", "#5b3df5"),
      texture: "none",
      buttonVariant: "glass",
      fonts: { title: "space-grotesk", body: "inter" },
      colors: { name: "#ffffff", handle: "#a1a1aa", icons: "#ffffff" },
    },
    linkStyle: { fillType: "color", fillValue: "#ffffff", textColor: "#ffffff", corner: "more", animation: "none" },
  },
  peach: {
    label: "Peach",
    tagline: "Warm & soft",
    theme: {
      preset: "peach",
      pageBg: gradientBg("linear", "#ffdcc2", "#f5a3c7"),
      texture: "grain",
      buttonVariant: "soft",
      fonts: { title: "poppins", body: "poppins" },
      colors: { name: "#3b1f2b", handle: "#6b4453", icons: "#3b1f2b" },
    },
    linkStyle: { fillType: "color", fillValue: "#ffffff", textColor: "#3b1f2b", corner: "pill", animation: "none" },
  },
  editorial: {
    label: "Editorial",
    tagline: "Clean & refined",
    theme: {
      preset: "editorial",
      pageBg: { type: "color", value: "#f3eee6", overlay: 0 },
      texture: "grain",
      buttonVariant: "outline",
      fonts: { title: "playfair", body: "dm-sans" },
      colors: { name: "#111111", handle: "#5c554b", icons: "#111111" },
    },
    linkStyle: { fillType: "color", fillValue: "#111111", textColor: "#111111", corner: "square", animation: "none" },
  },
  pop: {
    label: "Pop",
    tagline: "Loud & bold",
    theme: {
      preset: "pop",
      pageBg: { type: "color", value: "#dfff4f", overlay: 0 },
      texture: "none",
      buttonVariant: "hard",
      fonts: { title: "bebas", body: "space-grotesk" },
      colors: { name: "#0a0a0a", handle: "#2a2a2a", icons: "#0a0a0a" },
    },
    linkStyle: { fillType: "color", fillValue: "#ffffff", textColor: "#0a0a0a", corner: "rounded", animation: "none" },
  },
};

// ─── LINK STYLE RESOLVER ──────────────────────────────────────────────────────

/** Map DB row fields to LinkStyle (handles missing/defaulted columns). */
export function resolveLinkStyle(row: {
  fill_type?: string | null;
  fill_value?: string | null;
  text_color?: string | null;
  corner?: string | null;
  animation?: string | null;
}): LinkStyle {
  return {
    fillType: (row.fill_type as LinkStyle["fillType"]) ?? DEFAULT_LINK_STYLE.fillType,
    fillValue: row.fill_value ?? DEFAULT_LINK_STYLE.fillValue,
    textColor: row.text_color ?? DEFAULT_LINK_STYLE.textColor,
    corner: (row.corner as LinkStyle["corner"]) ?? DEFAULT_LINK_STYLE.corner,
    animation: (row.animation as LinkStyle["animation"]) ?? DEFAULT_LINK_STYLE.animation,
  };
}

// ─── SAFE THEME MERGE ─────────────────────────────────────────────────────────

const isColor = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Merge raw DB value with DEFAULT_THEME; silently drops removed fields (button/title/text/animation/containerBg).
 * Presets that no longer exist (glacier, sunset, …) become "custom" so those pages keep their look.
 */
export function resolveTheme(raw: Record<string, unknown> | null | undefined): Theme {
  if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return DEFAULT_THEME;

  const r = raw as Record<string, unknown>;
  const pageBgRaw = (r.pageBg ?? {}) as Record<string, unknown>;
  const fontsRaw = (r.fonts ?? {}) as Record<string, unknown>;
  const colorsRaw = (r.colors ?? {}) as Record<string, unknown>;
  const gradientRaw = (pageBgRaw.gradient ?? {}) as Record<string, unknown>;

  const preset: Theme["preset"] =
    typeof r.preset === "string" && Object.hasOwn(PRESETS, r.preset) ? (r.preset as PresetKey) : "custom";
  const gradient =
    (gradientRaw.style === "linear" || gradientRaw.style === "glow") &&
    isColor(gradientRaw.from) &&
    isColor(gradientRaw.to)
      ? { style: gradientRaw.style as GradientStyle, from: gradientRaw.from, to: gradientRaw.to }
      : undefined;
  const variant = BUTTON_VARIANTS.find((v) => v.id === r.buttonVariant)?.id;

  return {
    preset,
    pageBg: {
      type: (pageBgRaw.type as Theme["pageBg"]["type"]) ?? DEFAULT_THEME.pageBg.type,
      value: (pageBgRaw.value as string) ?? DEFAULT_THEME.pageBg.value,
      overlay: typeof pageBgRaw.overlay === "number" ? pageBgRaw.overlay : DEFAULT_THEME.pageBg.overlay,
      blur: typeof pageBgRaw.blur === "number" ? pageBgRaw.blur : 0,
      ...(gradient && pageBgRaw.type === "gradient" ? { gradient } : {}),
      lastColor: typeof pageBgRaw.lastColor === "string" ? pageBgRaw.lastColor : undefined,
      lastGradient: typeof pageBgRaw.lastGradient === "string" ? pageBgRaw.lastGradient : undefined,
      lastImage: typeof pageBgRaw.lastImage === "string" ? pageBgRaw.lastImage : undefined,
    },
    texture: r.texture === "grain" ? "grain" : "none",
    buttonVariant: variant ?? DEFAULT_THEME.buttonVariant,
    fonts: {
      title: (fontsRaw.title as string) ?? DEFAULT_THEME.fonts.title,
      body: (fontsRaw.body as string) ?? DEFAULT_THEME.fonts.body,
    },
    colors: {
      name: (colorsRaw.name as string) ?? DEFAULT_THEME.colors.name,
      handle: (colorsRaw.handle as string) ?? DEFAULT_THEME.colors.handle,
      icons: (colorsRaw.icons as string) ?? DEFAULT_THEME.colors.icons,
    },
  };
}
