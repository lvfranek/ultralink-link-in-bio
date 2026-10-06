"use client";

import { useId, useState, type CSSProperties } from "react";
import { Check, Eye, Lock, Search, X } from "lucide-react";
import {
  BUTTON_CORNERS,
  BUTTON_VARIANTS,
  FONT_OPTIONS,
  PRESETS,
  bgCss,
  buttonLook,
  fontVar,
  titleStyle,
  type ButtonVariant,
  type PresetKey,
} from "@/lib/config/theme";
import { COUNTRY_NAMES, flagEmoji } from "@/lib/countries";
import { WinBackDialog } from "@/components/public/win-back-overlay";
import { useUpgradeModal } from "@/components/app/upgrade-context";
import { cx, Dialog, Segmented } from "@/components/app/ui";
import {
  normalizeUrl,
  presetDraft,
  tidyUrl,
  urlError,
  type Colors,
  type DesignFields,
  type Draft,
  type DraftBg,
} from "./draft";
import { Card, ColorField, contrast, ProBadge, Switch } from "./parts";
import s from "@/components/app/app.module.css";

// ─── Design ──────────────────────────────────────────────────────────────────

const COLOR_FIELDS: { key: Exclude<keyof Colors, "background">; label: string }[] = [
  { key: "button", label: "Buttons" },
  { key: "buttonText", label: "Button text" },
  { key: "name", label: "Name and headings" },
  { key: "text", label: "Bio and @handle" },
  { key: "icons", label: "Social icons" },
];

const BG_KINDS: { value: DraftBg["kind"]; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "linear", label: "Gradient" },
  { value: "glow", label: "Glow" },
];

/** CSS background of the page as the draft has it */
function draftBackground(d: Pick<Draft, "bg" | "colors">) {
  return d.bg.kind === "solid"
    ? d.colors.background
    : bgCss({ style: d.bg.kind, from: d.colors.background, to: d.bg.to });
}

/** Glass and outline buttons show the page through, so their text sits on the page background */
const isSeeThrough = (v: ButtonVariant) => v === "glass" || v === "outline";

/** The button text colour, swapped for black or white when it would be unreadable in this look */
function readableButtonText(variant: ButtonVariant, colors: Colors) {
  const behind = isSeeThrough(variant) ? colors.background : colors.button;
  if (contrast(colors.buttonText, behind) >= 3) return colors.buttonText;
  return contrast("#ffffff", behind) >= contrast("#0a0a0a", behind) ? "#ffffff" : "#0a0a0a";
}

/** Thumbnail-sized buttons: thinner outline, smaller hard shadow */
const MINI_BTN = { "--btn-edge": "1.5px", "--btn-offset": "2.5px" } as CSSProperties;

export function DesignCard({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  // Any hand-made change turns the page into a custom theme
  const tweak = (p: Partial<Draft>) => set({ ...p, preset: "custom" });
  const pageBg = draftBackground(draft);
  const seeThrough = isSeeThrough(draft.buttonVariant);
  const against: Record<(typeof COLOR_FIELDS)[number]["key"], string | null> = {
    button: draft.buttonVariant === "outline" ? draft.colors.background : null,
    buttonText: seeThrough ? draft.colors.background : draft.colors.button,
    name: draft.colors.background,
    text: draft.colors.background,
    icons: draft.colors.background,
  };

  return (
    <>
      <Card title="Theme" aside={draft.preset === "custom" && <span className={s.count}>Customised</span>}>
        <div className={s.presetGrid} role="radiogroup" aria-label="Theme">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const look = presetDraft(key);
            const on = draft.preset === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                className={cx(s.preset, on && s.presetOn)}
                onClick={() => set(look)}
              >
                <ThemeSwatch design={look} />
                <span className={s.presetName}>
                  {PRESETS[key].label}
                  {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                </span>
                <span className={s.presetTag}>{PRESETS[key].tagline}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Background">
        <Segmented
          label="Background style"
          value={draft.bg.kind}
          onChange={(kind) => tweak({ bg: { ...draft.bg, kind } })}
          options={BG_KINDS}
        />
        <div className={s.colorGrid} style={{ marginTop: 16 }}>
          <ColorField
            label={draft.bg.kind === "solid" ? "Colour" : draft.bg.kind === "glow" ? "Base" : "Top"}
            value={draft.colors.background}
            warn={false}
            onChange={(v) => tweak({ colors: { ...draft.colors, background: v } })}
          />
          {draft.bg.kind !== "solid" && (
            <ColorField
              label={draft.bg.kind === "glow" ? "Glow" : "Bottom"}
              value={draft.bg.to}
              warn={false}
              onChange={(to) => tweak({ bg: { ...draft.bg, to } })}
            />
          )}
        </div>
        <div className={s.settingRow} style={{ marginTop: 16 }}>
          <div>
            <p className={s.settingTitle}>Film grain</p>
            <p className={s.settingDesc}>A fine texture that makes flat colours feel printed.</p>
          </div>
          <Switch checked={draft.grain} onChange={(grain) => tweak({ grain })} label="Film grain" />
        </div>
      </Card>

      <Card title="Buttons">
        <span className={s.label}>Style</span>
        <div className={s.btnStyleGrid} role="radiogroup" aria-label="Button style">
          {BUTTON_VARIANTS.map((v) => {
            const look = buttonLook(v.id, {
              fillValue: draft.colors.button,
              textColor: readableButtonText(v.id, draft.colors),
              corner: draft.corner,
            });
            const on = draft.buttonVariant === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={cx(s.btnStyle, on && s.btnStyleOn)}
                onClick={() =>
                  tweak({
                    buttonVariant: v.id,
                    colors: { ...draft.colors, buttonText: readableButtonText(v.id, draft.colors) },
                  })
                }
              >
                <span className={s.btnStyleCanvas} style={{ background: pageBg }} aria-hidden="true">
                  <span
                    className={cx(s.btnStyleSample, look.className)}
                    style={{ ...look.style, ...MINI_BTN, fontFamily: fontVar(draft.bodyFont) }}
                  >
                    Aa
                  </span>
                </span>
                <span className={s.btnStyleName}>{v.label}</span>
              </button>
            );
          })}
        </div>
        <span className={s.label} style={{ marginTop: 18 }}>
          Shape
        </span>
        <Segmented
          label="Button shape"
          value={draft.corner}
          onChange={(corner) => tweak({ corner })}
          options={BUTTON_CORNERS.map((c) => ({ value: c.id, label: c.label }))}
        />
      </Card>

      <Card title="Colours">
        <div className={s.colorGrid}>
          {COLOR_FIELDS.map(({ key, label }) => (
            <ColorField
              key={key}
              label={label}
              value={draft.colors[key]}
              warn={!!against[key] && contrast(draft.colors[key], against[key]) < 3}
              onChange={(v) => tweak({ colors: { ...draft.colors, [key]: v } })}
            />
          ))}
        </div>
      </Card>

      <Card title="Fonts">
        <div className={s.row2}>
          <FontSelect
            label="Name and headings"
            value={draft.titleFont}
            onChange={(titleFont) => tweak({ titleFont })}
          />
          <FontSelect label="Bio and buttons" value={draft.bodyFont} onChange={(bodyFont) => tweak({ bodyFont })} />
        </div>
      </Card>
    </>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  const id = useId();
  return (
    <div>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={s.select}
        value={value}
        style={{ fontFamily: fontVar(value) }}
        onChange={(e) => onChange(e.target.value)}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.id} value={f.id} style={{ fontFamily: fontVar(f.id) }}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A theme tile's mini page: its real background, name font and button look */
function ThemeSwatch({ design }: { design: DesignFields }) {
  const look = buttonLook(design.buttonVariant, {
    fillValue: design.colors.button,
    textColor: design.colors.buttonText,
    corner: design.corner,
  });
  return (
    <span className={s.presetCanvas} style={{ background: draftBackground(design) }} aria-hidden="true">
      {design.grain && <span className="ul-grain" />}
      <span className={s.presetDot} />
      <span
        className={s.presetTitle}
        style={{
          color: design.colors.name,
          fontFamily: fontVar(design.titleFont),
          fontWeight: titleStyle(design.titleFont).fontWeight,
        }}
      >
        Aa
      </span>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cx(s.presetPill, look.className)} style={{ ...look.style, ...MINI_BTN }} />
      ))}
    </span>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

const COUNTRIES = Object.entries(COUNTRY_NAMES).sort((x, y) => x[1].localeCompare(y[1]));

export function SettingsCard({
  draft,
  set,
  pro,
  preview,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  pro: boolean;
  /** Theme and first button the Win-Back popup is styled from */
  preview: {
    theme: Parameters<typeof WinBackDialog>[0]["theme"];
    firstLink: Parameters<typeof WinBackDialog>[0]["firstLink"];
  };
}) {
  const openUpgrade = useUpgradeModal();
  const [picking, setPicking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const wb = draft.winBack;
  const setWb = (patch: Partial<Draft["winBack"]>) => set({ winBack: { ...wb, ...patch } });
  const wbError = wb.enabled && wb.url ? urlError(wb.url) : null;
  const blocked = draft.blockedCountries;
  const locked = (
    <button type="button" className={cx(s.btnLight, s.btnSm)} onClick={openUpgrade}>
      <Lock size={13} aria-hidden="true" /> Upgrade
    </button>
  );

  return (
    <>
      <Card title="Visibility">
        <div className={s.settingRow}>
          <div>
            <p className={s.settingTitle}>18+ age check for the whole page</p>
            <p className={s.settingDesc}>Visitors confirm their age before they see anything.</p>
          </div>
          <Switch
            checked={draft.ageGate}
            onChange={(ageGate) => set({ ageGate })}
            label="18+ age check for the whole page"
          />
        </div>
        <div className={s.settingRow}>
          <div>
            <p className={s.settingTitle}>&ldquo;Active now&rdquo; badge {!pro && <ProBadge />}</p>
            <p className={s.settingDesc}>A green dot next to your name, so fans know you&apos;re around.</p>
          </div>
          {pro ? (
            <Switch checked={draft.badge} onChange={(badge) => set({ badge })} label="Active now badge" />
          ) : (
            locked
          )}
        </div>
        <div className={s.settingRow}>
          <div>
            <p className={s.settingTitle}>Country blocking {!pro && <ProBadge />}</p>
            <p className={s.settingDesc}>
              {pro && blocked.length
                ? `Hidden in ${blocked.length} ${blocked.length === 1 ? "country" : "countries"}.`
                : "Hide your page from visitors in the countries you pick."}
            </p>
          </div>
          {pro ? (
            <button type="button" className={cx(s.btnGhost, s.btnSm)} onClick={() => setPicking(true)}>
              {blocked.length ? "Edit" : "Choose countries"}
            </button>
          ) : (
            locked
          )}
        </div>
        {pro && blocked.length > 0 && (
          <ul className={s.chips} aria-label="Blocked countries">
            {blocked.map((code) => (
              <li key={code} className={s.countryChip}>
                <span aria-hidden="true">{flagEmoji(code)}</span>
                {COUNTRY_NAMES[code] ?? code}
                <button
                  type="button"
                  onClick={() => set({ blockedCountries: blocked.filter((c) => c !== code) })}
                  aria-label={`Unblock ${COUNTRY_NAMES[code] ?? code}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={s.settingRow}>
          <div>
            <p className={s.settingTitle}>
              Custom domain <span className={s.soon}>Soon</span>
            </p>
            <p className={s.settingDesc}>Use your own address, like links.yourname.com.</p>
          </div>
        </div>
      </Card>

      <Card title="Win-Back">
        <div className={s.settingRow} style={{ borderTop: "none", paddingTop: 0 }}>
          <div>
            <p className={s.settingTitle}>Show an offer before visitors leave {!pro && <ProBadge />}</p>
            <p className={s.settingDesc}>One last link for people who are about to close your page.</p>
          </div>
          {pro ? <Switch checked={wb.enabled} onChange={(enabled) => setWb({ enabled })} label="Win-Back" /> : locked}
        </div>
        <div className={cx(s.expand, pro && wb.enabled && s.expandOpen)} inert={!(pro && wb.enabled)}>
          <div>
            <div className={s.row2} style={{ paddingTop: 16 }}>
              <div>
                <label className={s.label} htmlFor="ed-wb-head">
                  Headline
                </label>
                <input
                  id="ed-wb-head"
                  className={cx(s.input, wb.enabled && !wb.headline.trim() && s.inputError)}
                  value={wb.headline}
                  maxLength={80}
                  placeholder="e.g. Wait! Get 20% off"
                  onChange={(e) => setWb({ headline: e.target.value })}
                />
                {wb.enabled && !wb.headline.trim() && (
                  <p className={cx(s.hint, s.err)}>Add a headline for the popup.</p>
                )}
              </div>
              <div>
                <label className={s.label} htmlFor="ed-wb-url">
                  Link
                </label>
                <input
                  id="ed-wb-url"
                  className={cx(s.input, wbError && s.inputError)}
                  value={wb.url}
                  inputMode="url"
                  spellCheck={false}
                  placeholder="https://"
                  aria-invalid={!!wbError}
                  onChange={(e) => setWb({ url: e.target.value })}
                  onBlur={() => setWb({ url: tidyUrl(wb.url) })}
                />
                {wbError && <p className={cx(s.hint, s.err)}>{wbError}</p>}
              </div>
            </div>
            <div className={s.settingRow} style={{ marginTop: 14 }}>
              <div>
                <p className={s.settingTitle}>18+ check before the link opens</p>
                <p className={s.settingDesc}>Visitors confirm their age before the Win-Back link opens.</p>
              </div>
              <Switch
                checked={wb.ageGate}
                onChange={(ageGate) => setWb({ ageGate })}
                label="18+ check before the Win-Back link opens"
              />
            </div>
            <button
              type="button"
              className={cx(s.btnGhost, s.btnBlock)}
              style={{ marginTop: 4 }}
              disabled={!wb.headline.trim() || !!urlError(wb.url)}
              onClick={() => setPreviewing(true)}
            >
              <Eye size={15} aria-hidden="true" /> Preview popup
            </button>
          </div>
        </div>
      </Card>

      {picking && (
        <CountryDialog
          initial={blocked}
          onClose={() => setPicking(false)}
          onSave={(blockedCountries) => {
            set({ blockedCountries });
            setPicking(false);
          }}
        />
      )}
      {previewing && (
        // The exact popup visitors see, shared with the live page
        <WinBackDialog
          winBack={{ enabled: true, headline: wb.headline, url: normalizeUrl(wb.url), age_gate: wb.ageGate }}
          theme={preview.theme}
          avatarUrl={draft.avatarUrl}
          title={draft.name}
          firstLink={preview.firstLink}
          onDismiss={() => setPreviewing(false)}
        />
      )}
    </>
  );
}

function CountryDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string[];
  onSave: (codes: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState(initial);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query
    ? COUNTRIES.filter(([code, name]) => name.toLowerCase().includes(query) || code.toLowerCase() === query)
    : COUNTRIES;
  const toggle = (code: string) => setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));

  return (
    <Dialog
      title="Block countries"
      description="Visitors from these countries can't open your page. Everyone else sees it as usual."
      onClose={onClose}
      className={s.countryDialog}
    >
      <label className={s.searchField} style={{ width: "100%" }}>
        <Search size={15} aria-hidden="true" />
        <span className={s.srOnly}>Search countries</span>
        <input type="search" placeholder="Search countries…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <ul className={s.countryList} aria-label="Countries">
        {shown.length === 0 && <li className={s.countryEmpty}>No country matches “{q}”.</li>}
        {shown.map(([code, name]) => (
          <li key={code}>
            <label className={s.countryRow}>
              <input type="checkbox" checked={picked.includes(code)} onChange={() => toggle(code)} />
              <span className={s.flag} aria-hidden="true">
                {flagEmoji(code)}
              </span>
              {name}
            </label>
          </li>
        ))}
      </ul>
      <div className={s.dialogActions} style={{ alignItems: "center" }}>
        <span className={s.countSel}>
          {picked.length} selected
          {picked.length > 0 && (
            <button type="button" onClick={() => setPicked([])}>
              Clear
            </button>
          )}
        </span>
        <button type="button" className={s.btnGhost} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={s.btnLight} onClick={() => onSave(picked)}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
