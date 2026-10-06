"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateSlug } from "@/lib/slug";
import { getLinkCap } from "@/lib/config/pricing";
import { getActiveOwnerId } from "@/lib/team";
import { PRESETS, type Theme } from "@/lib/config/theme";
import { genericDbError } from "@/lib/db-error";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export type ActionResult = { error: string } | { ok: true } | { ok: true; pageId: string };

// Starting point for every newly created page — modeled on a hand-designed
// reference page so a fresh page looks intentional instead of a blank slate.
const NEW_PAGE_BIO = "Hello world!";
const NEW_PAGE_AVATAR_URL = "/favicon/favicon.png";
// New pages start on the Noir theme
const NEW_PAGE_THEME: Theme = PRESETS.noir.theme;
const NEW_PAGE_LINK = {
  label: "Link 1",
  url: "http://www.instagram.com/",
  fill_type: PRESETS.noir.linkStyle.fillType,
  fill_value: PRESETS.noir.linkStyle.fillValue,
  text_color: PRESETS.noir.linkStyle.textColor,
  corner: PRESETS.noir.linkStyle.corner,
  animation: "none",
};

export async function createPage(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = ((formData.get("slug") as string) ?? "").toLowerCase().trim();
  const title = ((formData.get("title") as string) ?? "").trim();

  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };
  if (!title) return { error: "Title is required." };

  const activeOwnerId = await getActiveOwnerId(user.id, supabase);

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, grace_period_ends_at, plan_tier")
    .eq("id", activeOwnerId)
    .single();

  const cap = getLinkCap(profile ?? { subscription_status: "none", grace_period_ends_at: null, plan_tier: null });

  const { count } = await supabase
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", activeOwnerId);

  if ((count ?? 0) >= cap) {
    return {
      error: `You've reached your plan's link limit. Upgrade to add more.`,
    };
  }

  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      owner_id: activeOwnerId,
      slug,
      title,
      bio: NEW_PAGE_BIO,
      avatar_url: NEW_PAGE_AVATAR_URL,
      theme: NEW_PAGE_THEME,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return { error: "That username is already taken." };
    return genericDbError("pages.createPage", error);
  }

  const { error: linkError } = await supabase.from("page_links").insert({
    page_id: page.id,
    ...NEW_PAGE_LINK,
    item_type: "button",
    position: 0,
  });
  if (linkError) {
    // The page itself was created successfully — don't fail the whole
    // action over the cosmetic starter link.
    console.error("Failed to insert starter link for new page:", linkError);
  }

  revalidatePath("/dashboard");
  return { ok: true, pageId: page.id };
}

export async function updatePage(id: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = ((formData.get("slug") as string) ?? "").toLowerCase().trim();
  const title = ((formData.get("title") as string) ?? "").trim();
  const bio = ((formData.get("bio") as string) ?? "").trim();
  const is_active = formData.get("is_active") === "true";
  const avatar_url = (formData.get("avatar_url") as string | null) ?? undefined;
  const avatar_style = (formData.get("avatar_style") as string | null) ?? undefined;
  const active_badge = formData.get("active_badge") === "true";
  // Only changed when the form sends it. The editor has no age-gate switch, and
  // reading a missing field as "off" silently disabled the gate on every save.
  const age_gate_enabled = formData.has("age_gate_enabled") ? formData.get("age_gate_enabled") === "true" : undefined;

  const blockedCountriesStr = formData.get("blocked_countries") as string | null;
  let blocked_countries: string[] = [];
  if (blockedCountriesStr) {
    try {
      const parsed = JSON.parse(blockedCountriesStr);
      if (Array.isArray(parsed)) {
        blocked_countries = parsed.filter((c: unknown) => typeof c === "string" && /^[A-Z]{2}$/.test(c));
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const winBackStr = formData.get("win_back") as string | null;
  let win_back: { enabled: boolean; headline: string; url: string; age_gate: boolean } = {
    enabled: false,
    headline: "",
    url: "",
    age_gate: false,
  };
  if (winBackStr) {
    try {
      const parsed = JSON.parse(winBackStr);
      if (parsed && typeof parsed === "object") {
        const enabled = !!parsed.enabled;
        const headline = String(parsed.headline ?? "").slice(0, 80);
        const rawUrl = String(parsed.url ?? "");
        const url = rawUrl && !/^https?:\/\//i.test(rawUrl) ? `https://${rawUrl}` : rawUrl;
        const age_gate = !!parsed.age_gate;
        win_back = { enabled, headline, url, age_gate };
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const themeStr = formData.get("theme") as string | null;
  let theme: Record<string, unknown> | undefined;
  if (themeStr) {
    try {
      theme = JSON.parse(themeStr);
    } catch {
      return { error: "Invalid theme data." };
    }
  }

  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };
  if (!title) return { error: "Title is required." };

  if (avatar_style && avatar_style !== "circle" && avatar_style !== "hero") {
    return { error: "Invalid avatar style." };
  }

  const activeOwnerId = await getActiveOwnerId(user.id, supabase);

  const { data: existing } = await supabase
    .from("pages")
    .select("id, slug")
    .eq("id", id)
    .eq("owner_id", activeOwnerId)
    .single();

  if (!existing) return { error: "Page not found." };

  if (slug !== existing.slug) {
    const { count } = await supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("slug", slug)
      .neq("id", id);
    if ((count ?? 0) > 0) return { error: "That username is already taken." };
  }

  const { error } = await supabase
    .from("pages")
    .update({
      slug,
      title,
      bio,
      is_active,
      active_badge,
      blocked_countries,
      win_back,
      updated_at: new Date().toISOString(),
      ...(age_gate_enabled !== undefined ? { age_gate_enabled } : {}),
      ...(avatar_url !== undefined ? { avatar_url } : {}),
      ...(avatar_style !== undefined ? { avatar_style } : {}),
      ...(theme !== undefined ? { theme } : {}),
    })
    .eq("id", id)
    .eq("owner_id", activeOwnerId);

  if (error) {
    if (error.code === "23505") return { error: "That username is already taken." };
    return genericDbError("pages.updatePage", error);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/${slug}`);
  return { ok: true };
}

export async function deletePage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeOwnerId = await getActiveOwnerId(user.id, supabase);

  const { error } = await supabase.from("pages").delete().eq("id", id).eq("owner_id", activeOwnerId);

  if (error) return genericDbError("pages.deletePage", error);

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function duplicatePage(sourcePageId: string, newSlug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = newSlug.toLowerCase().trim();
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };

  const activeOwnerId = await getActiveOwnerId(user.id, supabase);

  const { data: source } = await supabase
    .from("pages")
    .select("*")
    .eq("id", sourcePageId)
    .eq("owner_id", activeOwnerId)
    .single();

  if (!source) return { error: "Page not found." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, grace_period_ends_at, plan_tier")
    .eq("id", activeOwnerId)
    .single();

  const cap = getLinkCap(profile ?? { subscription_status: "none", grace_period_ends_at: null, plan_tier: null });

  const { count } = await supabase
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", activeOwnerId);

  if ((count ?? 0) >= cap) {
    return {
      error: `You've reached your plan's link limit. Upgrade to add more.`,
    };
  }

  const { count: slugTaken } = await supabase
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("slug", slug);
  if ((slugTaken ?? 0) > 0) return { error: "That username is already taken." };

  const {
    id: _id,
    slug: _slug,
    owner_id: _ownerId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...sourceRest
  } = source;

  const { data: newPage, error: insertError } = await supabase
    .from("pages")
    .insert({ ...sourceRest, slug, owner_id: activeOwnerId })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") return { error: "That username is already taken." };
    return { error: insertError.message };
  }

  try {
    const { data: sourceLinks, error: linksError } = await supabase
      .from("page_links")
      .select("*")
      .eq("page_id", sourcePageId)
      .order("position", { ascending: true });
    if (linksError) throw linksError;

    if (sourceLinks && sourceLinks.length > 0) {
      const newLinks = sourceLinks.map((l) => {
        const { id: _lid, page_id: _lpid, created_at: _lca, ...rest } = l;
        return { ...rest, page_id: newPage.id };
      });
      const { error } = await supabase.from("page_links").insert(newLinks);
      if (error) throw error;
    }

    const { data: sourceSocials, error: socialsError } = await supabase
      .from("page_socials")
      .select("*")
      .eq("page_id", sourcePageId)
      .order("position", { ascending: true });
    if (socialsError) throw socialsError;

    if (sourceSocials && sourceSocials.length > 0) {
      const newSocials = sourceSocials.map((s) => {
        const { id: _sid, page_id: _spid, created_at: _sca, ...rest } = s;
        return { ...rest, page_id: newPage.id };
      });
      const { error } = await supabase.from("page_socials").insert(newSocials);
      if (error) throw error;
    }
  } catch {
    await supabase.from("pages").delete().eq("id", newPage.id);
    return { error: "Failed to duplicate all page content. Please try again." };
  }

  revalidatePath("/dashboard");
  return { ok: true, pageId: newPage.id };
}

export async function checkSlugAvailable(
  slug: string,
  excludeId?: string,
): Promise<{ available: boolean; error?: string }> {
  const validationError = validateSlug(slug);
  if (validationError) return { available: false, error: validationError };

  // Called on every debounced keystroke while typing a username (hero +
  // signup forms), so the limit stays generous — this is only meant to
  // stop automated slug enumeration, not normal typing.
  const ip = await getClientIp();
  if (!rateLimit(`check-slug:${ip}`, 30, 60).allowed) {
    return { available: false, error: "Too many checks. Please wait a moment." };
  }

  const supabase = await createClient();
  let query = supabase.from("pages").select("id", { count: "exact", head: true }).eq("slug", slug);

  if (excludeId) query = query.neq("id", excludeId);

  const { count } = await query;
  if ((count ?? 0) > 0) return { available: false, error: "That username is already taken." };

  return { available: true };
}
