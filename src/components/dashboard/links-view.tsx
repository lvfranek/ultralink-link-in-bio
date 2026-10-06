"use client";

import { useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Check,
  CircleCheck,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  LayoutGrid,
  List,
  Lock,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Percent,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { createPage, deletePage, duplicatePage } from "@/app/actions/pages";
import type { WeekStats } from "@/lib/dashboard-stats";
import type { SubscriptionStatus } from "@/lib/supabase/types";
import { useUpgradeModal } from "@/components/app/upgrade-context";
import { LimitDialog, SlugDialog } from "@/components/app/slug-dialog";
import { useToast } from "@/components/app/toast";
import {
  Avatar,
  cx,
  Delta,
  Dialog,
  RainbowBorder,
  Segmented,
  Sparkline,
  spotlight,
  themeVars,
  useCountUp,
  usePopover,
} from "@/components/app/ui";
import { useNavigationLoading } from "@/components/dashboard/navigation-loading";
import { buttonLook, type ButtonVariant, type LinkStyle } from "@/lib/config/theme";
import s from "@/components/app/app.module.css";

export interface PageCardData {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  edited: string;
  /** CSS background of the public page: a colour, gradient or image */
  background: string;
  nameColor: string;
  grain: boolean;
  buttonVariant: ButtonVariant;
  buttons: { label: string; background: string; color: string; corner: LinkStyle["corner"] }[];
}

type Sort = "newest" | "oldest" | "name";
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name (A → Z)" },
];

const compact = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : Math.round(n).toLocaleString("en-US");
const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
const ctr = (clicks: number, views: number) => (views ? (clicks / views) * 100 : 0);

export function LinksView({
  pages,
  stats,
  firstName,
  siteUrl,
  linkCap,
  initialSlug,
  upgraded,
  subscriptionStatus,
  gracePeriodEndsAt,
  survivingPageId,
  lapsed,
}: {
  pages: PageCardData[];
  /** null on Free: analytics are a Pro feature */
  stats: WeekStats | null;
  firstName: string;
  siteUrl: string;
  linkCap: number;
  initialSlug: string;
  upgraded: boolean;
  subscriptionStatus: SubscriptionStatus;
  gracePeriodEndsAt: string | null;
  survivingPageId: string | null;
  lapsed: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const openUpgrade = useUpgradeModal();
  const { startLoading } = useNavigationLoading();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState<{ slug: string } | null>(null);
  const [duplicating, setDuplicating] = useState<PageCardData | null>(null);
  const [deleting, setDeleting] = useState<PageCardData | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const host = siteUrl.replace(/^https?:\/\//, "");
  const atCap = pages.length >= linkCap;
  const isHidden = (p: PageCardData) => lapsed && survivingPageId !== null && p.id !== survivingPageId;

  const shown = pages
    .filter((p) => `${p.name} ${p.slug}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "name") return (a.name || a.slug).localeCompare(b.name || b.slug);
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "oldest" ? diff : -diff;
    });

  const openCreate = (slug = "") => {
    setDialogError(null);
    setCreating({ slug });
  };

  const create = (slug: string) =>
    startTransition(async () => {
      const form = new FormData();
      form.set("slug", slug);
      // The profile name starts as the link; it's changed in the editor
      form.set("title", slug);
      const result = await createPage(null, form);
      if ("error" in result) return setDialogError(result.error);
      if ("pageId" in result) {
        startLoading();
        router.push(`/dashboard/links/${result.pageId}`);
      }
    });

  const duplicate = (source: PageCardData, slug: string) =>
    startTransition(async () => {
      const result = await duplicatePage(source.id, slug);
      if ("error" in result) return setDialogError(result.error);
      if ("pageId" in result) {
        startLoading();
        router.push(`/dashboard/links/${result.pageId}`);
      }
    });

  const remove = (page: PageCardData) =>
    startTransition(async () => {
      const result = await deletePage(page.id);
      setDeleting(null);
      if ("error" in result) return toast(result.error);
      toast(`${host}/${page.slug} deleted`);
      router.refresh();
    });

  const actions: Actions = {
    copy: (p) => {
      void navigator.clipboard?.writeText(`${siteUrl}/${p.slug}`);
      toast("Link copied to clipboard");
    },
    open: (p) => window.open(`${siteUrl}/${p.slug}`, "_blank", "noopener"),
    duplicate: (p) => {
      setDialogError(null);
      setDuplicating(p);
    },
    remove: setDeleting,
    startLoading,
  };

  const banner = (
    <Banners
      upgraded={upgraded}
      subscriptionStatus={subscriptionStatus}
      gracePeriodEndsAt={gracePeriodEndsAt}
      hiddenCount={lapsed && survivingPageId ? pages.length - 1 : 0}
    />
  );

  const dialogs = (
    <>
      {creating &&
        (atCap ? (
          <LimitDialog
            cap={linkCap}
            onClose={() => setCreating(null)}
            onUpgrade={() => {
              setCreating(null);
              openUpgrade();
            }}
          />
        ) : (
          <SlugDialog
            title="New link page"
            description="Pick the link you'll put in your bio. You can change everything else later."
            submitLabel="Create page"
            initialSlug={creating.slug}
            pending={pending}
            error={dialogError}
            onSubmit={create}
            onClose={() => setCreating(null)}
          />
        ))}
      {duplicating &&
        (atCap ? (
          <LimitDialog
            cap={linkCap}
            onClose={() => setDuplicating(null)}
            onUpgrade={() => {
              setDuplicating(null);
              openUpgrade();
            }}
          />
        ) : (
          <SlugDialog
            title="Duplicate page"
            description={`Copies the design, links and settings of ${host}/${duplicating.slug} to a new link.`}
            submitLabel="Duplicate"
            pending={pending}
            error={dialogError}
            onSubmit={(slug) => duplicate(duplicating, slug)}
            onClose={() => setDuplicating(null)}
          />
        ))}
      {deleting && (
        <Dialog
          title={`Delete ${deleting.name || deleting.slug}?`}
          description={
            <>
              <strong style={{ color: "#fff" }}>
                {host}/{deleting.slug}
              </strong>{" "}
              stops working right away, and its stats are deleted with it. This can&apos;t be undone.
            </>
          }
          onClose={() => setDeleting(null)}
        >
          <div className={s.dialogActions}>
            <button type="button" className={s.btnGhost} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button type="button" className={s.btnDanger} disabled={pending} onClick={() => remove(deleting)}>
              <Trash2 size={15} aria-hidden="true" /> Delete page
            </button>
          </div>
        </Dialog>
      )}
    </>
  );

  if (pages.length === 0) {
    return (
      <>
        {banner}
        <EmptyState initialSlug={initialSlug} onClaim={openCreate} />
        {dialogs}
      </>
    );
  }

  return (
    <>
      {banner}
      <div className={cx(s.pageHead, s.enter)}>
        <h1 className={s.h1}>
          {firstName ? (
            <>
              Welcome back, <span className={s.serif}>{firstName}.</span>
            </>
          ) : (
            <>
              Welcome <span className={s.serif}>back.</span>
            </>
          )}
        </h1>
      </div>

      <StatStrip stats={stats} />

      <div className={s.toolbar}>
        <h2 className={s.toolbarTitle}>
          Your pages
          <span className={s.count}>
            {pages.length} / {linkCap}
          </span>
        </h2>
        <label className={s.searchField}>
          <Search size={15} aria-hidden="true" />
          <span className={s.srOnly}>Search pages</span>
          <input type="search" placeholder="Search pages…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <SortMenu value={sort} onChange={setSort} />
        <div className={s.hideSm}>
          <Segmented
            label="Layout"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <LayoutGrid size={15} aria-hidden="true" />, aria: "Grid view" },
              { value: "list", label: <List size={15} aria-hidden="true" />, aria: "List view" },
            ]}
          />
        </div>
        <button type="button" className={cx(s.btnLight, s.btnSm, s.toolbarBtn)} onClick={() => openCreate()}>
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" /> New page
        </button>
      </div>

      {shown.length === 0 ? (
        <p style={{ textAlign: "center", color: "var(--subtle)", padding: "48px 0" }}>No pages match “{q}”.</p>
      ) : view === "grid" ? (
        <div className={s.pagesGrid}>
          {shown.map((p, i) => (
            <PageCard
              key={p.id}
              page={p}
              host={host}
              siteUrl={siteUrl}
              index={i}
              hidden={isHidden(p)}
              stats={stats ? (stats.perPage[p.id] ?? { views: 0, clicks: 0 }) : null}
              {...actions}
            />
          ))}
          {!q && (
            <button
              type="button"
              className={cx(s.newCard, s.enter)}
              onClick={() => openCreate()}
              style={{ animationDelay: `${shown.length * 60}ms` }}
            >
              <span className={s.newIcon} aria-hidden="true">
                <span className={s.spinner} />
                <span>
                  <Plus size={22} />
                </span>
              </span>
              <span className={s.newTitle}>New link page</span>
              <span className={s.newSub}>
                {atCap ? "Upgrade for more pages" : `${linkCap - pages.length} of ${linkCap} left on your plan`}
              </span>
            </button>
          )}
        </div>
      ) : (
        <PageTable pages={shown} host={host} stats={stats} isHidden={isHidden} actions={actions} />
      )}

      {dialogs}
    </>
  );
}

// ─── Banners ─────────────────────────────────────────────────────────────────

function Banners({
  upgraded,
  subscriptionStatus,
  gracePeriodEndsAt,
  hiddenCount,
}: {
  upgraded: boolean;
  subscriptionStatus: SubscriptionStatus;
  gracePeriodEndsAt: string | null;
  hiddenCount: number;
}) {
  const openUpgrade = useUpgradeModal();
  const grace = subscriptionStatus === "grace" && gracePeriodEndsAt;
  if (!upgraded && !grace && hiddenCount === 0) return null;
  return (
    <div className={s.banners}>
      {upgraded && (
        <div className={cx(s.notice, s.noticeOk)} role="status">
          <CircleCheck size={17} aria-hidden="true" />
          <p>You&apos;re now on Pro. Your pages and analytics are live.</p>
        </div>
      )}
      {grace && (
        <div className={cx(s.notice, s.noticeBad)} role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <p>
            Your payment failed. Update your card by{" "}
            <strong>
              {new Date(gracePeriodEndsAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </strong>{" "}
            or your pages go offline.
          </p>
          <Link href="/dashboard/account" className={cx(s.btnLight, s.btnSm)}>
            Manage billing
          </Link>
        </div>
      )}
      {!grace && hiddenCount > 0 && (
        <div className={s.notice} role="status">
          <Lock size={16} aria-hidden="true" />
          <p>
            Your subscription has ended.{" "}
            <strong>
              {hiddenCount} {hiddenCount === 1 ? "page is" : "pages are"} hidden
            </strong>{" "}
            until you resubscribe.
          </p>
          <button type="button" className={cx(s.btnLight, s.btnSm)} onClick={openUpgrade}>
            <Sparkles size={14} aria-hidden="true" /> Resubscribe
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

// Blurred filler behind the lock on Free, so the strip keeps its shape
const SAMPLE: WeekStats = {
  views: 12480,
  clicks: 8020,
  prevViews: 11000,
  prevClicks: 7300,
  recovered: 64,
  prevRecovered: 51,
  viewsDaily: [1500, 1700, 1600, 2100, 1800, 1900, 1880],
  clicksDaily: [960, 1100, 990, 1400, 1180, 1220, 1170],
  perPage: {},
};

function StatStrip({ stats }: { stats: WeekStats | null }) {
  const openUpgrade = useUpgradeModal();
  const st = stats ?? SAMPLE;
  const ctrDaily = st.viewsDaily.map((v, i) => ctr(st.clicksDaily[i], v));
  return (
    <section className={cx(s.strip, s.enter)} style={{ animationDelay: "80ms" }} aria-label="Last 7 days">
      <StatCell
        icon={<Eye size={14} aria-hidden="true" />}
        label="Views · 7 days"
        value={st.views}
        format={compact}
        delta={<Delta current={st.views} previous={st.prevViews} />}
        spark={st.viewsDaily}
      />
      <StatCell
        icon={<MousePointerClick size={14} aria-hidden="true" />}
        label="Clicks"
        value={st.clicks}
        format={compact}
        delta={<Delta current={st.clicks} previous={st.prevClicks} />}
        spark={st.clicksDaily}
        color="#c9a7f2"
      />
      <StatCell
        icon={<Percent size={14} aria-hidden="true" />}
        label="Click-through rate"
        value={ctr(st.clicks, st.views)}
        format={(n) => pct(n)}
        delta={<Delta current={ctr(st.clicks, st.views)} previous={ctr(st.prevClicks, st.prevViews)} />}
        spark={ctrDaily}
        color="#a7c7f7"
      />
      <StatCell
        icon={<Undo2 size={14} aria-hidden="true" />}
        label="Saved by Win-Back"
        value={st.recovered}
        format={(n) => Math.round(n).toLocaleString("en-US")}
        delta={<Delta current={st.recovered} previous={st.prevRecovered} />}
        spark={st.viewsDaily.map(() => 0)}
        color="#fbc2a4"
      />
      {!stats && (
        <div className={s.locked}>
          <span className={s.lockedText}>
            <Lock size={15} aria-hidden="true" />
            <span>
              <strong>Analytics</strong> is part of Pro
            </span>
          </span>
          <button type="button" className={cx(s.btnLight, s.btnSm)} onClick={openUpgrade}>
            <Sparkles size={14} aria-hidden="true" /> Upgrade
          </button>
        </div>
      )}
    </section>
  );
}

function StatCell({
  icon,
  label,
  value,
  format,
  delta,
  spark,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format: (n: number) => string;
  delta: React.ReactNode;
  spark: number[];
  color?: string;
}) {
  const shown = useCountUp(value, true);
  return (
    <div className={s.stripCell}>
      <div className={s.statLabel}>
        {icon}
        {label}
      </div>
      <div className={s.statValueRow}>
        <span className={s.statValue}>{format(shown)}</span>
        {delta}
      </div>
      <Sparkline data={spark} color={color} />
    </div>
  );
}

// ─── Page cards ──────────────────────────────────────────────────────────────

interface Actions {
  copy: (p: PageCardData) => void;
  open: (p: PageCardData) => void;
  duplicate: (p: PageCardData) => void;
  remove: (p: PageCardData) => void;
  startLoading: () => void;
}

/** Scales the outline and hard shadow down to thumbnail size */
const MINI_BTN = { "--btn-edge": "1px", "--btn-offset": "2px" } as CSSProperties;

function MiniPhone({ page }: { page: PageCardData }) {
  return (
    <div className={s.miniPhone} style={{ background: page.background }} aria-hidden="true">
      {page.grain && <div className="ul-grain" />}
      {page.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image (Supabase Storage URL)
        <img src={page.avatarUrl} alt="" className={s.miniAvatarImg} />
      ) : (
        <Avatar name={page.name || page.slug} size={38} round className={s.miniAvatar} />
      )}
      <div className={s.miniName} style={{ color: page.nameColor }}>
        {page.name || page.slug}
      </div>
      {page.buttons.map((b, i) => {
        const look = buttonLook(page.buttonVariant, { fillValue: b.background, textColor: b.color, corner: b.corner });
        return (
          <div key={i} className={cx(s.miniPill, look.className)} style={{ ...look.style, ...MINI_BTN }}>
            {b.label}
          </div>
        );
      })}
    </div>
  );
}

function PageCard({
  page,
  host,
  siteUrl,
  index,
  hidden,
  stats,
  ...a
}: {
  page: PageCardData;
  host: string;
  siteUrl: string;
  index: number;
  hidden: boolean;
  stats: { views: number; clicks: number } | null;
} & Actions) {
  const [copied, setCopied] = useState(false);
  const accent = page.buttons[0]?.background ?? "#f7a8c4";
  return (
    <article
      className={cx(s.card, s.pageCard, hidden && s.pageCardHidden)}
      onPointerMove={spotlight}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={s.preview} style={themeVars([accent, accent, accent])}>
        <MiniPhone page={page} />
        <span className={s.statusPill}>
          <span className={hidden ? s.hiddenDot : s.liveDot} aria-hidden="true" />
          {hidden ? "Hidden" : "Live"}
        </span>
      </div>
      <div className={s.cardMenu}>
        <PageMenu page={page} {...a} />
      </div>

      <div className={s.pageBody}>
        <h3 className={s.pageTitle}>{page.name || page.slug}</h3>
        <div className={s.pageUrl}>
          <a href={`${siteUrl}/${page.slug}`} target="_blank" rel="noopener noreferrer">
            {host}/{page.slug}
          </a>
          <button
            type="button"
            className={cx(s.iconBtn, s.iconBtnBare)}
            style={{ width: 24, height: 24, color: copied ? "var(--green)" : undefined }}
            aria-label={`Copy ${host}/${page.slug}`}
            onClick={() => {
              a.copy(page);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          </button>
        </div>

        {hidden ? (
          <p className={s.hiddenNote}>
            Hidden from visitors while your subscription is inactive.{" "}
            <Link href="/dashboard/account" style={{ color: "#fff", textDecoration: "underline" }}>
              Restore it
            </Link>
          </p>
        ) : stats ? (
          <div className={s.pageStats} style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div>
              <div className={s.psLabel}>Views · 7d</div>
              <div className={s.psValue}>{compact(stats.views)}</div>
            </div>
            <div>
              <div className={s.psLabel}>Clicks</div>
              <div className={s.psValue}>{compact(stats.clicks)}</div>
            </div>
            <div>
              <div className={s.psLabel}>CTR</div>
              <div className={s.psValue}>{pct(ctr(stats.clicks, stats.views), 0)}</div>
            </div>
          </div>
        ) : (
          <p className={s.hiddenNote}>
            <Lock size={12} aria-hidden="true" style={{ display: "inline", verticalAlign: -1, marginRight: 6 }} />
            Views and clicks are part of Pro.
          </p>
        )}

        <div className={s.pageFoot}>
          <span className={s.edited}>Edited {page.edited}</span>
          <Link href={`/dashboard/links/${page.id}`} className={cx(s.btnGhost, s.btnSm)} onClick={a.startLoading}>
            <Pencil size={13} aria-hidden="true" /> Edit
          </Link>
        </div>
      </div>
    </article>
  );
}

function PageTable({
  pages,
  host,
  stats,
  isHidden,
  actions,
}: {
  pages: PageCardData[];
  host: string;
  stats: WeekStats | null;
  isHidden: (p: PageCardData) => boolean;
  actions: Actions;
}) {
  return (
    <div className={s.table} role="table" aria-label="Your pages">
      <div className={cx(s.tRow, s.tHead)} role="row">
        <span role="columnheader">Page</span>
        <span role="columnheader" className={s.tHideSm}>
          Views · 7d
        </span>
        <span role="columnheader" className={s.tHideSm}>
          Clicks
        </span>
        <span role="columnheader" className={s.tHide}>
          CTR
        </span>
        <span role="columnheader" className={s.tHide}>
          Status
        </span>
        <span role="columnheader" className={s.srOnly}>
          Actions
        </span>
      </div>
      {pages.map((p, i) => {
        const st = stats?.perPage[p.id];
        const hidden = isHidden(p);
        return (
          <div key={p.id} className={s.tRow} role="row" style={{ animationDelay: `${i * 40}ms` }}>
            <span className={s.tPage} role="cell">
              <span className={s.tThumb} style={{ background: p.background }} aria-hidden="true" />
              <span style={{ minWidth: 0 }}>
                <span className={s.pageTitle} style={{ display: "block", fontSize: 14 }}>
                  {p.name || p.slug}
                </span>
                <span className={s.tlHost}>
                  {host}/{p.slug}
                </span>
              </span>
            </span>
            <span role="cell" className={cx(s.tNum, s.tHideSm)}>
              {st ? compact(st.views) : "—"}
            </span>
            <span role="cell" className={cx(s.tNum, s.tHideSm)}>
              {st ? compact(st.clicks) : "—"}
            </span>
            <span role="cell" className={cx(s.tNum, s.tHide)}>
              {st ? pct(ctr(st.clicks, st.views)) : "—"}
            </span>
            <span role="cell" className={s.tHide}>
              <span className={s.statusPill} style={{ position: "static" }}>
                <span className={hidden ? s.hiddenDot : s.liveDot} />
                {hidden ? "Hidden" : "Live"}
              </span>
            </span>
            <span role="cell" className={s.tActions}>
              <button
                type="button"
                className={cx(s.iconBtn, s.iconBtnBare)}
                onClick={() => actions.copy(p)}
                aria-label={`Copy ${host}/${p.slug}`}
              >
                <Copy size={15} aria-hidden="true" />
              </button>
              <Link
                href={`/dashboard/links/${p.id}`}
                className={cx(s.iconBtn, s.iconBtnBare)}
                onClick={actions.startLoading}
                aria-label={`Edit ${p.name || p.slug}`}
              >
                <Pencil size={15} aria-hidden="true" />
              </Link>
              <PageMenu page={p} {...actions} bare />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PageMenu({ page, bare = false, ...a }: { page: PageCardData; bare?: boolean } & Actions) {
  const { open, setOpen, ref } = usePopover();
  const item = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const label = page.name || page.slug;
  return (
    <div className={s.popWrap} ref={ref}>
      <button
        type="button"
        className={cx(s.iconBtn, bare && s.iconBtnBare)}
        onClick={() => setOpen((o) => !o)}
        aria-label={`More actions for ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <Link
            href={`/dashboard/links/${page.id}`}
            role="menuitem"
            className={s.menuItem}
            onClick={() => {
              setOpen(false);
              a.startLoading();
            }}
          >
            <Pencil size={15} aria-hidden="true" /> Edit page
          </Link>
          <button type="button" role="menuitem" className={s.menuItem} onClick={item(() => a.open(page))}>
            <ExternalLink size={15} aria-hidden="true" /> Open live page
          </button>
          <button type="button" role="menuitem" className={s.menuItem} onClick={item(() => a.copy(page))}>
            <Copy size={15} aria-hidden="true" /> Copy link
          </button>
          <Link
            href={`/dashboard/analytics?page=${page.id}`}
            role="menuitem"
            className={s.menuItem}
            onClick={() => {
              setOpen(false);
              a.startLoading();
            }}
          >
            <BarChart3 size={15} aria-hidden="true" /> View analytics
          </Link>
          <button type="button" role="menuitem" className={s.menuItem} onClick={item(() => a.duplicate(page))}>
            <CopyPlus size={15} aria-hidden="true" /> Duplicate
          </button>
          <div className={s.menuSep} role="separator" />
          <button
            type="button"
            role="menuitem"
            className={cx(s.menuItem, s.menuDanger)}
            onClick={item(() => a.remove(page))}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function SortMenu({ value, onChange }: { value: Sort; onChange: (v: Sort) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className={s.popWrap} ref={ref}>
      <button
        type="button"
        className={cx(s.btnGhost, s.btnSm)}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{ fontWeight: 500, height: 38 }}
      >
        <ArrowUpDown size={14} aria-hidden="true" />
        {SORTS.find((o) => o.value === value)?.label}
      </button>
      {open && (
        <div className={s.menu} role="menu">
          {SORTS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              className={s.menuItem}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {o.value === value && <Check size={15} className={s.check} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ initialSlug, onClaim }: { initialSlug: string; onClaim: (slug: string) => void }) {
  const [slug, setSlug] = useState(initialSlug);
  return (
    <div className={cx(s.empty, s.enter)}>
      <div className={s.emptyGrid} aria-hidden="true" />
      <h1 className={s.emptyTitle}>
        Claim your <span className={s.serif}>link.</span>
      </h1>
      <p className={s.emptySub}>Pick the name for your bio link. It takes a minute, and Free stays free forever.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onClaim(slug);
        }}
      >
        <RainbowBorder className={s.claim}>
          <label htmlFor="claim-input" className={s.claimPrefix}>
            ultralink.bio/
          </label>
          <input
            id="claim-input"
            className={s.claimInput}
            value={slug}
            placeholder="yourname"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
          <button type="submit" className={s.btnLight}>
            Claim <ArrowRight size={15} className={s.nudge} aria-hidden="true" />
          </button>
        </RainbowBorder>
      </form>
      <p className={s.claimHint}>Free forever · No card needed · Live in 60 seconds</p>
    </div>
  );
}
