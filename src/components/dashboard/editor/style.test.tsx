// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveTheme } from "@/lib/config/theme";
import type { Page } from "@/lib/supabase/types";
import { draftFromPage, presetDraft, type Draft } from "./draft";
import { DesignCard, SettingsCard } from "./style";

// Pulled in via the upgrade dialog; talks to Supabase and Stripe
vi.mock("@/app/actions/billing", () => ({ startCheckout: vi.fn() }));

afterEach(cleanup);

function Harness({ url }: { url: string }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    ...draftFromPage({ title: "Franek", theme: null, win_back: null } as unknown as Page, [], []),
    winBack: { enabled: true, headline: "Wait! Watch my new video.", url, ageGate: false },
  }));
  return (
    <SettingsCard
      draft={draft}
      set={(p) => setDraft((d) => ({ ...d, ...p }))}
      pro
      preview={{ theme: resolveTheme(null), firstLink: null }}
    />
  );
}

describe("Win-Back preview", () => {
  it("stays disabled until the popup has a valid link", () => {
    render(<Harness url="" />);
    expect(screen.getByRole("button", { name: "Preview popup" })).toBeDisabled();
  });

  it("shows the real popup, with https:// added to bare domains like saving does", async () => {
    render(<Harness url="youtube.com" />);
    await userEvent.click(screen.getByRole("button", { name: "Preview popup" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Wait! Watch my new video.");
    expect(screen.getByRole("link", { name: /Yes, show me/ })).toHaveAttribute("href", "https://youtube.com");
  });

  it("closes with Escape", async () => {
    render(<Harness url="https://youtube.com" />);
    await userEvent.click(screen.getByRole("button", { name: "Preview popup" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function DesignHarness({ onChange }: { onChange: (d: Draft) => void }) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromPage({ title: "Franek", theme: null, win_back: null } as unknown as Page, [], []),
  );
  return (
    <DesignCard
      draft={draft}
      set={(p) =>
        setDraft((d) => {
          const next = { ...d, ...p };
          onChange(next);
          return next;
        })
      }
    />
  );
}

describe("Design themes", () => {
  it("applies the whole look of a theme in one click", async () => {
    let draft: Draft | null = null;
    render(<DesignHarness onChange={(d) => (draft = d)} />);
    await userEvent.click(screen.getByRole("radio", { name: /Pop/ }));
    expect(draft).toMatchObject(presetDraft("pop"));
    expect(screen.getByRole("radio", { name: /Pop/ })).toHaveAttribute("aria-checked", "true");
  });

  it("turns into a custom theme once part of it is changed", async () => {
    let draft: Draft | null = null;
    render(<DesignHarness onChange={(d) => (draft = d)} />);
    await userEvent.click(screen.getByRole("radio", { name: /Noir/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Outline" }));
    expect(draft).toMatchObject({ preset: "custom", buttonVariant: "outline", bg: { kind: "glow" } });
    expect(screen.getByText("Customised")).toBeInTheDocument();
  });

  it("keeps button text readable when the button style changes", async () => {
    let draft: Draft | null = null;
    render(<DesignHarness onChange={(d) => (draft = d)} />);
    // Noir: white text on see-through glass buttons
    await userEvent.click(screen.getByRole("radio", { name: /Noir/ }));
    const styles = within(screen.getByRole("radiogroup", { name: "Button style" }));
    await userEvent.click(styles.getByRole("radio", { name: "Solid" }));
    // White text on a white solid button would vanish
    expect(draft!.colors).toMatchObject({ button: "#ffffff", buttonText: "#0a0a0a" });
  });
});
