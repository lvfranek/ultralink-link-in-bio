"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { WinBack, PageLink } from "@/lib/supabase/types";
import {
  resolveTheme,
  fontVar,
  titleStyle,
  buttonLook,
  animClass,
  resolveLinkStyle,
  gradientEndColor,
  DEFAULT_LINK_STYLE,
} from "@/lib/config/theme";
import type { Theme } from "@/lib/config/theme";
import { isAdultConfirmed, showAdultGate } from "./adult-gate";

interface WinBackOverlayProps {
  pageId: string;
  winBack: WinBack;
  rawTheme: Record<string, unknown> | null;
  avatarUrl: string | null;
  title: string;
  firstLink: PageLink | null;
}

function beacon(pageId: string, kind: "shown" | "click") {
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      `/api/track/winback?page_id=${encodeURIComponent(pageId)}&kind=${kind}`
    );
  }
}

export function WinBackOverlay({
  pageId,
  winBack,
  rawTheme,
  avatarUrl,
  title,
  firstLink,
}: WinBackOverlayProps) {
  const [open, setOpen] = useState(false);

  const trigger = useCallback(() => {
    setOpen(true);
    beacon(pageId, "shown");
  }, [pageId]);

  // Exit-intent detection
  useEffect(() => {
    if (open) return;

    const isMobile =
      window.innerWidth < 768 || navigator.maxTouchPoints > 0;

    if (isMobile) {
      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          trigger();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () =>
        document.removeEventListener("visibilitychange", handleVisibility);
    } else {
      const handleMouseOut = (e: MouseEvent) => {
        if (e.clientY <= 0 && !e.relatedTarget) {
          trigger();
        }
      };
      document.addEventListener("mouseout", handleMouseOut);
      return () => document.removeEventListener("mouseout", handleMouseOut);
    }
  }, [open, trigger]);

  if (!open) return null;

  return (
    <WinBackDialog
      winBack={winBack}
      theme={resolveTheme(rawTheme)}
      avatarUrl={avatarUrl}
      title={title}
      firstLink={firstLink}
      onDismiss={() => setOpen(false)}
      onCtaClick={(e) => {
        if (!winBack.age_gate) {
          beacon(pageId, "click");
          return;
        }
        e.preventDefault();
        if (isAdultConfirmed()) {
          beacon(pageId, "click");
          window.open(winBack.url, "_blank", "noopener,noreferrer");
          return;
        }
        showAdultGate(() => {
          beacon(pageId, "click");
          window.open(winBack.url, "_blank", "noopener,noreferrer");
        });
      }}
    />
  );
}

interface WinBackDialogProps {
  winBack: WinBack;
  theme: Theme;
  avatarUrl: string | null;
  title: string;
  firstLink: PageLink | null;
  onDismiss: () => void;
  /** Tracking/age-gate hook for the live page. Omitted in the editor preview, so the link just opens. */
  onCtaClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/** The Win-Back popup itself — shared by the live page and the editor preview. */
export function WinBackDialog({
  winBack,
  theme,
  avatarUrl,
  title,
  firstLink,
  onDismiss,
  onCtaClick,
}: WinBackDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const cardBg = theme.pageBg.type === "image" ? "#0A0A0B" : theme.pageBg.value;
  const ls = firstLink
    ? resolveLinkStyle(firstLink)
    : {
        ...DEFAULT_LINK_STYLE,
        fillType: "color" as const,
        fillValue: theme.colors.name,
        textColor: theme.pageBg.type === "gradient" ? gradientEndColor(cardBg) : cardBg,
      };
  const look = buttonLook(theme.buttonVariant ?? "solid", ls);
  const btnAnimCls = animClass(ls.animation);
  const titleFont = fontVar(theme.fonts.title);
  const nameColor = theme.colors.name;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- matchMedia is browser-only
    setPrefersReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Fade-in animation: tick to mounted after a frame
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Focus management: move focus into the card, give it back on close
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    cardRef.current
      ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
      ?.focus();
    return () => prevFocus?.focus();
  }, []);

  // Keyboard: Escape + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;

      const focusable = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])"
        )
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const transition = prefersReducedMotion
    ? "none"
    : "opacity 180ms ease, transform 180ms ease";

  // Portal to <body> so `position: fixed` covers the viewport even inside
  // transformed/overflow-hidden containers (e.g. the editor side panel).
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        opacity: mounted ? 1 : 0,
        transition: prefersReducedMotion ? "none" : "opacity 180ms ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Before you go"
    >
      <div
        ref={cardRef}
        className="w-full flex flex-col items-center text-center"
        style={{
          maxWidth: 420,
          padding: "2rem 1.75rem",
          background: cardBg,
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          border: "1px solid rgba(255,255,255,0.1)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "scale(1)" : "scale(0.96)",
          transition,
        }}
      >
        {/* Avatar */}
        <div className="mb-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL), shown as-is rather than through Next's image optimizer
            <img
              src={avatarUrl}
              alt={title}
              className="w-14 h-14 rounded-full object-cover border-2 border-white/10"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: "#ffffff", color: "#0A0A0B" }}
              aria-hidden="true"
            >
              {(title || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Headline */}
        <p
          className="text-lg font-bold leading-snug mb-6"
          style={{ color: nameColor, fontFamily: titleFont, fontWeight: titleStyle(theme.fonts.title).fontWeight }}
        >
          {winBack.headline}
        </p>

        {/* CTA button */}
        <a
          href={winBack.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center justify-center font-semibold text-sm py-3.5 mb-3 ${look.className} ${btnAnimCls}`}
          style={{ ...look.style, fontFamily: fontVar(theme.fonts.body) }}
          onClick={onCtaClick}
        >
          Yes, show me →
        </a>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm transition-opacity hover:opacity-70 cursor-pointer"
          style={{ color: nameColor, opacity: 0.45 }}
        >
          No thanks
        </button>
      </div>
    </div>,
    document.body,
  );
}
