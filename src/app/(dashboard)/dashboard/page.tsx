import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { getLinkCap } from "@/lib/config/pricing";
import { resolveTheme, type LinkStyle } from "@/lib/config/theme";
import { isProActive } from "@/lib/supabase/types";
import { getActiveOwnerId } from "@/lib/team";
import { editedAgo, getWeekStats } from "@/lib/dashboard-stats";
import { LinksView, type PageCardData } from "@/components/dashboard/links-view";
import type { Page, SubscriptionStatus } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Links",
  robots: { index: false, follow: false },
};

type PreviewLink = { label: string; fill_type: string; fill_value: string; text_color: string; corner: string };

/** What a page card's mini phone needs: the page's own background, name colour and first buttons */
function toCard(page: Page & { page_links: PreviewLink[] }): PageCardData {
  const theme = resolveTheme(page.theme as Record<string, unknown>);
  const bg = theme.pageBg;
  return {
    id: page.id,
    slug: page.slug,
    name: page.title,
    avatarUrl: page.avatar_url,
    createdAt: page.created_at,
    edited: editedAgo(page.updated_at),
    background: bg.type === "image" ? `#111 url("${bg.value}") center / cover` : bg.value,
    nameColor: theme.colors.name,
    grain: theme.texture === "grain",
    buttonVariant: theme.buttonVariant,
    buttons: page.page_links.map((l) => ({
      label: l.label,
      background: l.fill_value,
      color: l.text_color,
      corner: l.corner as LinkStyle["corner"],
    })),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string; upgraded?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const activeOwnerId = await getActiveOwnerId(user.id, supabase);
  const isEditor = activeOwnerId !== user.id;

  const [pagesResult, profileResult, selfResult] = await Promise.all([
    supabase
      .from("pages")
      .select("*, page_links(label, fill_type, fill_value, text_color, corner, position)")
      .eq("owner_id", activeOwnerId)
      .eq("page_links.is_active", true)
      .eq("page_links.item_type", "button")
      .order("created_at", { ascending: false })
      .order("position", { referencedTable: "page_links", ascending: true })
      .limit(3, { referencedTable: "page_links" }),
    supabase
      .from("profiles")
      .select("subscription_status, grace_period_ends_at, plan_tier, stripe_customer_id")
      .eq("id", activeOwnerId)
      .single(),
    supabase.from("profiles").select("display_name, username").eq("id", user.id).single(),
  ]);

  const pages = (pagesResult.data ?? []) as (Page & { page_links: PreviewLink[] })[];
  const profile = profileResult.data ?? {
    subscription_status: "none" as SubscriptionStatus,
    grace_period_ends_at: null,
    plan_tier: null,
    stripe_customer_id: null,
  };

  const linkCap = getLinkCap(profile);
  // Analytics follow the plan of the account being viewed, also for team editors
  const pro = isProActive(profile);
  const sp = await searchParams;
  const lapsed = !isEditor && profile.subscription_status !== "none" && !isProActive(profile);

  // When a subscription lapses, only the oldest page stays public
  const survivingPageId =
    lapsed && pages.length > 0
      ? [...pages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0].id
      : null;

  const stats = pro
    ? await getWeekStats(
        supabase,
        pages.map((p) => p.id),
      )
    : null;

  const firstName = (selfResult.data?.display_name || selfResult.data?.username || "").split(" ")[0];

  return (
    <LinksView
      pages={pages.map(toCard)}
      stats={stats}
      firstName={firstName}
      siteUrl={getSiteUrl()}
      linkCap={linkCap}
      initialSlug={sp.username ?? ""}
      upgraded={sp.upgraded === "1"}
      subscriptionStatus={isEditor ? "active" : (profile.subscription_status as SubscriptionStatus)}
      gracePeriodEndsAt={isEditor ? null : profile.grace_period_ends_at}
      survivingPageId={survivingPageId}
      lapsed={lapsed}
    />
  );
}
