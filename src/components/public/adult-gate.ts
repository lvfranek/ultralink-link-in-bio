const OVERLAY_ID = "__ul_gate";

/**
 * Shows the shared 18+ confirmation interstitial on every click of a gated
 * link; nothing is remembered, so an earlier "yes" never skips it. Reused by
 * both per-link click gating and the Win-Back overlay's optional age gate —
 * do not duplicate this markup elsewhere.
 */
export function showAdultGate(onConfirm: () => void, onCancel?: () => void) {
  if (typeof document === "undefined") return;
  if (document.getElementById(OVERLAY_ID)) return;

  const prevFocus = document.activeElement as HTMLElement | null;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Age confirmation");
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "9999",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.7)", padding: "1rem",
    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
  });

  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px", padding: "2rem", maxWidth: "340px",
    width: "100%", textAlign: "center",
  });

  const badge = document.createElement("div");
  badge.textContent = "18+";
  Object.assign(badge.style, {
    display: "inline-block", fontSize: "1.5rem", fontWeight: "700",
    color: "#ffffff", marginBottom: "1rem",
  });

  const msg = document.createElement("p");
  msg.textContent = "This link may contain adult content. Are you 18 or older?";
  Object.assign(msg.style, {
    color: "#9a9a9a", fontSize: "0.875rem", lineHeight: "1.5", marginBottom: "1.5rem",
  });

  const btnYes = document.createElement("button");
  btnYes.type = "button";
  btnYes.textContent = "Yes, continue";
  Object.assign(btnYes.style, {
    display: "block", width: "100%", padding: "0.75rem",
    background: "#FFFFFF", color: "#0A0A0A", fontWeight: "600",
    fontSize: "0.875rem", borderRadius: "999px", border: "none",
    cursor: "pointer", marginBottom: "0.5rem",
  });

  const btnNo = document.createElement("button");
  btnNo.type = "button";
  btnNo.textContent = "No, go back";
  Object.assign(btnNo.style, {
    display: "block", width: "100%", padding: "0.75rem",
    background: "transparent", color: "#9a9a9a", fontWeight: "500",
    fontSize: "0.875rem", borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
  });

  function close() {
    document.removeEventListener("keydown", handleKeyDown);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    prevFocus?.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
      onCancel?.();
      return;
    }
    if (e.key !== "Tab") return;
    const first = btnYes;
    const last = btnNo;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  btnYes.addEventListener("click", () => {
    close();
    onConfirm();
  });

  btnNo.addEventListener("click", () => {
    close();
    onCancel?.();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      close();
      onCancel?.();
    }
  });

  document.addEventListener("keydown", handleKeyDown);

  box.appendChild(badge);
  box.appendChild(msg);
  box.appendChild(btnYes);
  box.appendChild(btnNo);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  btnYes.focus();
}
