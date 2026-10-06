"use client";

import { useEffect } from "react";
import type { Page, PageLink, PageSocial } from "@/lib/supabase/types";
import type { ButtonVariant, Theme } from "@/lib/config/theme";
import {
  resolveTheme,
  resolveLinkStyle,
  fontVar,
  titleStyle,
  buttonLook,
  animClass,
  gradientEndColor,
} from "@/lib/config/theme";
import { SocialIcon } from "./social-icon";
import { getPlatform } from "@/lib/config/socials";
import { isAdultConfirmed, showAdultGate } from "./adult-gate";
import Link from "next/link";

interface ProfilePageViewProps {
  page: Pick<Page, "slug" | "title" | "bio" | "avatar_url" | "avatar_style" | "active_badge">;
  links: PageLink[];
  socials: PageSocial[];
  theme?: Theme | Record<string, unknown> | null;
  isPreview?: boolean;
  /** Free plans show the "Build your own" CTA card above the footer; Pro pages show no promotion. */
  isPro?: boolean;
  /** Editor preview only: outlines the button being hovered in the editor */
  highlightLinkId?: string | null;
}

// Approximates whether a hex color reads as "light" (used to detect dark vs. light themes,
// since we only ever compute a per-theme text color, never a first-class "is this dark" flag).
function isLightColor(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length !== 6 && m.length !== 3) return true;
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

// The cover photo fades out at the bottom and lets the real page background show
// through, so it blends into any background: a colour, a gradient, a glow or an image.
// The extra stops ease the fade so it has no visible start line.
const HERO_FADE =
  "linear-gradient(to bottom, #000 0%, #000 40%, rgb(0 0 0 / 0.8) 58%, rgb(0 0 0 / 0.45) 75%, rgb(0 0 0 / 0.15) 90%, transparent 100%)";

// ─── Background layer helper ──────────────────────────────────────────────────

function BgLayer({ grain = false, ...props }: Parameters<typeof BgFill>[0] & { grain?: boolean }) {
  return (
    <>
      <BgFill {...props} />
      {grain && <div className="ul-grain" />}
    </>
  );
}

function BgFill({ pageBgIsImage, value, overlay, blur = 0, className = "absolute inset-0" }: {
  pageBgIsImage: boolean;
  value: string;
  overlay: number;
  blur?: number;
  className?: string;
}) {
  if (pageBgIsImage) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL), shown as-is rather than through Next's image optimizer */}
        <img
          src={value}
          alt=""
          aria-hidden
          className={`${className} w-full h-full object-cover`}
          style={blur > 0 ? { filter: `blur(${blur}px)`, transform: "scale(1.05)" } : undefined}
        />
        {overlay > 0 && (
          <div
            className="absolute inset-0"
            style={{ background: "#000000", opacity: overlay, mixBlendMode: "multiply" }}
          />
        )}
      </>
    );
  }
  return <div className={className} style={{ background: value }} />;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function ProfilePageView({
  page,
  links,
  socials,
  theme: rawTheme,
  isPreview,
  isPro,
  highlightLinkId,
}: ProfilePageViewProps) {
  // Always resolve: stored themes from before buttonVariant/texture existed lack those fields
  const t: Theme = resolveTheme(rawTheme as Record<string, unknown> | null | undefined);
  const grain = t.texture === "grain";

  const initial = (page.title || page.slug).charAt(0).toUpperCase();
  const isHero = page.avatar_style === "hero";

  const pageBgIsImage = t.pageBg.type === "image" && !!t.pageBg.value;
  const overlay = t.pageBg.overlay ?? 0;
  const bgBlur = t.pageBg.blur ?? 0;

  // Contrast for the bottom panel is judged against the actual page background,
  // not the name/handle text colors — those are independent user picks and can't
  // be trusted to indicate whether the surrounding surface is light or dark.
  // Image backgrounds vary in brightness per-pixel, so we assume dark there and
  // rely on the panel's own translucent scrim + blur for legibility.
  const panelOnLight = t.pageBg.type === "color"
    ? isLightColor(t.pageBg.value)
    : t.pageBg.type === "gradient"
    ? isLightColor(gradientEndColor(t.pageBg.value))
    : false;
  const panelBg = panelOnLight ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.10)";
  const panelBorder = panelOnLight ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.14)";
  const panelText = panelOnLight ? "#000000" : "#FFFFFF";

  // Keep html/body background in sync so iOS overscroll matches the page theme
  useEffect(() => {
    if (isPreview) return;
    const bg = pageBgIsImage ? "#000000" : (t.pageBg.value || "#000000");
    const prevHtml = document.documentElement.style.background;
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    return () => {
      document.documentElement.style.background = prevHtml;
      document.body.style.background = "";
    };
  }, [isPreview, pageBgIsImage, t.pageBg.value]);

  const titleFont = fontVar(t.fonts.title);
  const bodyFont  = fontVar(t.fonts.body);
  const nameColor   = t.colors.name;
  const handleColor = t.colors.handle;
  const iconsColor  = t.colors.icons;
  // Platforms we no longer support (e.g. removed ones still saved on old pages) are skipped
  const shownSocials = socials.filter((s) => getPlatform(s.platform));

  // ── Content shared between mobile and desktop ──────────────────────────────

  const heroActive = isHero && !!page.avatar_url;

  const content = (
    <>
      {/* Hero — full-bleed: no side padding, flush to the very top */}
      {heroActive && (
        <div className="relative z-1 w-full shrink-0 overflow-hidden" style={{ height: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL), shown as-is rather than through Next's image optimizer */}
          <img
            src={page.avatar_url!}
            alt={page.title || page.slug}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ maskImage: HERO_FADE, WebkitMaskImage: HERO_FADE }}
          />
        </div>
      )}

    <div className={`relative z-1 w-full flex flex-col items-center px-4 pb-8 ${heroActive ? "pt-4" : "pt-10"}`}>

      {/* Circle avatar — when not hero OR when hero but no photo yet (fallback) */}
      {(!isHero || !page.avatar_url) && (
        <div className="mb-5">
          {page.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL), shown as-is rather than through Next's image optimizer
            <img
              src={page.avatar_url}
              alt={page.title || page.slug}
              className="w-24 h-24 rounded-full object-cover border-2 border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold shadow-[0_0_20px_rgba(0,0,0,0.3)]"
              style={{ background: "#ffffff", color: "#0A0A0B" }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
        </div>
      )}

      {/* Name */}
      {page.title && (
        <h1
          className="font-bold text-center text-xl mb-2"
          style={{ color: nameColor, fontFamily: titleFont, ...titleStyle(t.fonts.title) }}
        >
          {page.title}
        </h1>
      )}

      {/* Slug handle */}
      <p className="text-center text-sm mb-3" style={{ color: handleColor }}>
        @{page.slug}
      </p>

      {/* Active badge */}
      {page.active_badge && (
        <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Active now</span>
        </div>
      )}

      {/* Bio */}
      {page.bio && (
        <p
          className="text-center leading-relaxed max-w-xs text-sm mb-8"
          style={{ color: handleColor, fontFamily: bodyFont }}
        >
          {page.bio}
        </p>
      )}

      {/* Socials icon row */}
      {shownSocials.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          {shownSocials.map((social) => (
            <a
              key={social.id}
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: iconsColor }}
              className="hover:opacity-80 transition-opacity"
              aria-label={getPlatform(social.platform)?.label ?? social.platform}
            >
              <SocialIcon platform={social.platform} size={20} />
            </a>
          ))}
        </div>
      )}

      {/* Link stack */}
      <div className="w-full space-y-3">
        {links.length > 0 ? (
          <nav
            className="w-full space-y-3"
            aria-label={`${page.title || page.slug}'s links`}
          >
            {links.map((link, index) =>
              link.item_type === "heading" ? (
                <HeadingItem key={link.id} label={link.label} color={link.text_color || nameColor} bodyFont={bodyFont} />
              ) : (
                <LinkButton
                  key={link.id}
                  link={link}
                  index={index}
                  isPreview={isPreview ?? false}
                  highlighted={link.id === highlightLinkId}
                  variant={t.buttonVariant}
                  font={bodyFont}
                />
              )
            )}
          </nav>
        ) : (
          !isPreview && (
            <p className="text-sm text-center mt-4" style={{ color: handleColor, opacity: 0.5 }}>
              No links yet.
            </p>
          )
        )}
      </div>

    </div>
    </>
  );

  const ctaCard = !isPro && (
    <a
      href="https://ultralink.bio"
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-0.5 text-center hover:opacity-80 transition-opacity"
    >
      <span className="text-sm font-medium" style={{ color: panelText, fontFamily: bodyFont }}>
        Build your own link hub — free.
      </span>
      <span className="text-xs" style={{ color: panelText, opacity: 0.65, fontFamily: bodyFont }}>
        Get yours at ultralink.bio →
      </span>
    </a>
  );

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    /*
     * Outer shell creates its own stacking context (position + z-index) so the
     * fixed desktop backdrop (z:0, root stacking context) sits visually behind
     * this shell when rendered on the public page.
     */
    <div
      className={`flex flex-col ${isPreview ? "min-h-full" : "min-h-dvh"}`}
      style={{ position: "relative", zIndex: 1 }}
    >
      {/*
       * Background layer.
       * Preview: always render as mobile (full-bleed bg) — media queries fire
       * on the viewport width, not the phone-frame width, so without this guard
       * `md:hidden` would suppress the background on any desktop viewport.
       */}
      <div className={`${isPreview ? "" : "md:hidden "}absolute inset-0 overflow-hidden`} aria-hidden>
        <BgLayer pageBgIsImage={pageBgIsImage} value={t.pageBg.value} overlay={overlay} blur={bgBlur} grain={grain} />
      </div>

      {/* ── Desktop: fixed blurred-avatar backdrop (hidden on <768px) ── */}
      {!isPreview && (
        <div
          className="hidden md:block fixed inset-0 overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden
        >
          {page.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL), shown as-is rather than through Next's image optimizer
            <img
              src={page.avatar_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: "blur(60px) saturate(1.1) brightness(0.65)",
                transform: "scale(1.15)",
              }}
            />
          ) : (
            /* No avatar — fall back to the theme background unmodified */
            <BgLayer pageBgIsImage={pageBgIsImage} value={t.pageBg.value} overlay={overlay} blur={bgBlur} grain={grain} />
          )}
        </div>
      )}

      {/* ── Content: full-bleed on mobile, centered card on desktop ── */}
      {/* Preview always uses mobile layout — no centering padding that would    */}
      {/* bleed through the phone frame as dark canvas around the content.       */}
      <div className={`relative flex-1 flex flex-col items-center${isPreview ? "" : " md:justify-center md:py-12 md:px-4"}`}>
        <div
          className={[
            "w-full relative overflow-hidden",
            // Desktop card shape (public page only)
            !isPreview && "md:max-w-120 md:rounded-4xl md:shadow-[0_10px_40px_rgba(0,0,0,.35),0_4px_12px_rgba(0,0,0,.25)]",
          ].filter(Boolean).join(" ")}
        >
          {/* Desktop card background — suppressed in preview (mobile bg covers everything) */}
          {!isPreview && (
            <div className="hidden md:block absolute inset-0" aria-hidden>
              <BgLayer pageBgIsImage={pageBgIsImage} value={t.pageBg.value} overlay={overlay} blur={bgBlur} grain={grain} />
            </div>
          )}

          {content}
        </div>
      </div>

      {/* ── Bottom panel: Free-plan CTA + legal row, bundled in one readable container ── */}
      {!isPreview && (
        <div className="relative z-1 w-full flex justify-center px-4 pb-8 mt-4">
          <div
            className="w-full max-w-120 flex flex-col items-center gap-3 rounded-2xl px-4 py-4"
            style={{
              background: panelBg,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: `1px solid ${panelBorder}`,
            }}
          >
            {ctaCard}

            <div className="flex items-center gap-4" style={{ opacity: 0.65 }}>
              <Link href="/privacy" className="text-xs hover:opacity-70 transition-opacity" style={{ color: panelText }}>
                Privacy
              </Link>
              <span className="text-xs" style={{ color: panelText }}>·</span>
              <Link href="/terms" className="text-xs hover:opacity-70 transition-opacity" style={{ color: panelText }}>
                Terms
              </Link>
              <span className="text-xs" style={{ color: panelText }}>·</span>
              <Link href="/imprint" className="text-xs hover:opacity-70 transition-opacity" style={{ color: panelText }}>
                Imprint
              </Link>
              <span className="text-xs" style={{ color: panelText }}>·</span>
              <a
                href={`mailto:report@ultralink.bio?subject=Report: ${encodeURIComponent(page.slug)}`}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: panelText }}
              >
                Report
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual link button ───────────────────────────────────────────────────

function HeadingItem({ label, color, bodyFont }: { label: string; color: string; bodyFont: string }) {
  if (!label.trim()) return null;
  return (
    <p
      className="w-full text-center text-xs font-semibold uppercase tracking-widest pt-2"
      style={{ color, opacity: 0.75, fontFamily: bodyFont }}
    >
      {label}
    </p>
  );
}

function LinkButton({
  link,
  index,
  isPreview,
  highlighted = false,
  variant,
  font,
}: {
  link: PageLink;
  index: number;
  isPreview: boolean;
  highlighted?: boolean;
  variant: ButtonVariant;
  font: string;
}) {
  const ls = resolveLinkStyle(link);
  const look = buttonLook(variant, ls);
  const animCls = animClass(ls.animation);

  const redirectHref = isPreview ? link.url : `/r/${link.id}`;
  const iconUrl = link.icon && link.icon.startsWith("http") ? link.icon : null;

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!link.is_adult || isPreview) return;
    if (isAdultConfirmed()) return;
    e.preventDefault();
    showAdultGate(() => window.open(redirectHref, "_blank", "noopener,noreferrer"));
  }

  return (
    <a
      href={redirectHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={[
        "relative flex items-center w-full font-medium",
        "px-5 py-4 text-sm",
        look.className,
        animCls,
      ].filter(Boolean).join(" ")}
      style={{
        ...look.style,
        fontFamily: font,
        animationDelay: ls.animation !== "none" ? `${index * 120}ms` : undefined,
        // An outline, not a shadow, so it never fights the Soft / Hard shadow looks
        outline: highlighted ? "2px solid #f7a8c4" : undefined,
        outlineOffset: highlighted ? 3 : undefined,
      }}
    >
      {/* Icon floats on the left without occupying flex space, so the
          label below always centers on the full button width. */}
      {iconUrl && (
        <span className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL), shown as-is rather than through Next's image optimizer */}
          <img src={iconUrl} alt="" className="shrink-0 w-5 h-5 object-contain rounded-sm" />
        </span>
      )}

      <span className="w-full text-center">{link.label || link.url}</span>

    </a>
  );
}
