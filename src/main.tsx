import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Plus,
  MagnifyingGlass,
  ShareNetwork,
  X,
  PencilSimple,
  Check,
  Flag,
  Trash,
  Info,
  ArrowUUpLeft,
} from "@phosphor-icons/react";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/600.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/kalam/400.css";
import {
  FONTS,
  INKS,
  SAFE_ZONE,
  signatureWidth,
  normalizePosition,
  validateDraft,
  safeSocial,
  findSignatures,
  type Draft,
  type Signature,
  type Point,
} from "./domain";
import {
  createDemoGuestbook,
  createHttpGuestbook,
  type Snapshot,
} from "./guestbook";
import artwork from "./artwork.json";
import "./styles.css";

const api = (import.meta as unknown as { env: { VITE_GUESTBOOK_API?: string } })
  .env.VITE_GUESTBOOK_API;
const guestbook = api
  ? createHttpGuestbook(api, artwork.available && artwork.safeRegionsVerified)
  : createDemoGuestbook();
const emptyDraft = (pageId: string): Draft => ({
  pageId,
  name: "",
  position: { x: 0.25, y: 0.52 },
  font: "caveat",
  ink: INKS[0],
  socials: [],
});
function Modal({
  label,
  onClose,
  children,
  className = "",
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLInputElement>("input,textarea")?.focus();
    const current = ref.current;
    return () => current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <button
          className="icon close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={22} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
function InkName({ name, font }: { name: string; font: Draft["font"] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      const el = ref.current;
      const parent = el?.parentElement;
      if (el && parent && active)
        setScale(Math.min(1, parent.clientWidth / Math.max(1, el.scrollWidth)));
    };
    const observer = new ResizeObserver(measure);
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement);
    void document.fonts.ready.then(measure);
    measure();
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [name, font]);
  return (
    <span
      ref={ref}
      className="ink-name"
      style={{ transform: `scale(${scale})` }}
    >
      {name}
    </span>
  );
}
function legibleName(draft: Draft) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const family = {
    caveat: "Caveat",
    dancing: "Dancing Script",
    kalam: "Kalam",
  }[draft.font];
  context.font = `100px "${family}"`;
  const needed = (context.measureText(draft.name.trim()).width / 100) * 0.042;
  if (needed > signatureWidth(draft.name.trim()))
    throw new Error(
      "That name is too wide to stay readable here. Please use a shorter display name.",
    );
}
function App() {
  const [data, setData] = useState<Snapshot>({ pages: [], signatures: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [flip, setFlip] = useState<"up" | "down" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editor, setEditor] = useState<
    "position" | "details" | "preview" | null
  >(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(""));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [links, setLinks] = useState(["", ""]);
  const [selected, setSelected] = useState<Signature | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [about, setAbout] = useState(false);
  const [mine, setMine] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const owners = useRef(new Map<string, string>());
  const submission = useRef(crypto.randomUUID());
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const page = data.pages[pageIndex];
  const visibleSignatures = [
    ...new Map(
      [
        ...data.signatures,
        ...(data.ownSignatures || []).filter((s) => s.status !== "rejected"),
      ].map((s) => [s.id, s]),
    ).values(),
  ];
  const signatures = visibleSignatures.filter((s) => s.pageId === page?.id);
  const isOwned = (id: string) =>
    demo
      ? owners.current.has(id)
      : !!data.ownSignatures?.some((s) => s.id === id);
  const demo = guestbook.mode === "demo";
  const artworkReady = artwork.available && artwork.safeRegionsVerified;
  async function refresh() {
    setLoading(true);
    setLoadError("");
    try {
      setData(await guestbook.load());
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  function navigate(delta: number) {
    if (editor || flip) return;
    const next = pageIndex + delta;
    if (next < 0 || next >= data.pages.length) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPageIndex(next);
      return;
    }
    setFlip(delta > 0 ? "up" : "down");
    timer.current = setTimeout(() => {
      setPageIndex(next);
      setFlip(null);
    }, 240);
  }
  function begin(e: React.MouseEvent<HTMLButtonElement>) {
    if (!page || flip) return;
    triggerRef.current = e.currentTarget;
    setDraft(emptyDraft(page.id));
    setEditingId(null);
    setLinks(["", ""]);
    setConsent(false);
    setError("");
    submission.current = crypto.randomUUID();
    setEditor("position");
    cardRef.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    requestAnimationFrame(() =>
      cardRef.current?.focus({ preventScroll: true }),
    );
  }
  function cancel() {
    setEditor(null);
    setError("");
    setEditingId(null);
    triggerRef.current?.focus();
  }
  function position(point: Point) {
    setDraft((d) => ({
      ...d,
      position: normalizePosition(point, d.name || "Your name"),
    }));
    setError("");
  }
  function cardKey(e: React.KeyboardEvent) {
    if (editor !== "position") return;
    const step = e.shiftKey ? 0.04 : 0.01;
    let p = { ...draft.position };
    if (e.key === "ArrowUp") p.y -= step;
    else if (e.key === "ArrowDown") p.y += step;
    else if (e.key === "ArrowLeft") p.x -= step;
    else if (e.key === "ArrowRight") p.x += step;
    else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      setEditor("details");
      return;
    } else if (e.key === "Escape") {
      cancel();
      return;
    } else return;
    e.preventDefault();
    position(p);
  }
  function preview(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!consent)
        throw new Error("Confirm the visibility notice to continue.");
      const socials = links
        .map(safeSocial)
        .filter((s): s is NonNullable<typeof s> => !!s);
      const next = validateDraft(
        { ...draft, socials },
        visibleSignatures.filter((s) => s.id !== editingId),
        data.pages,
      );
      legibleName(next);
      setDraft(next);
      setEditor("preview");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function publish() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const checked = validateDraft(
        draft,
        visibleSignatures.filter((s) => s.id !== editingId),
        data.pages,
      );
      if (editingId) {
        await guestbook.update(
          editingId,
          owners.current.get(editingId) || "",
          checked,
        );
      } else {
        const result = await guestbook.publish(checked, submission.current);
        if (result.ownerToken)
          owners.current.set(result.signature.id, result.ownerToken);
      }
      setData(await guestbook.load());
      setEditor(null);
      setEditingId(null);
      setNotice(
        demo
          ? "Added to this demo session. Nothing was published publicly."
          : "Sent for organizer review. Only you and organizers can see it until approved. Your signed-in account can edit or remove it later.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await guestbook.remove(
        selected.id,
        owners.current.get(selected.id) || "",
      );
      setData(await guestbook.load());
      setSelected(null);
      setNotice(
        demo
          ? "Removed from this demo session."
          : "Your signature was removed.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit() {
    if (!selected) return;
    setDraft({
      pageId: selected.pageId,
      name: selected.name,
      position: selected.position,
      font: selected.font,
      ink: selected.ink,
      socials: selected.socials,
    });
    setEditingId(selected.id);
    setLinks([selected.socials[0]?.url || "", selected.socials[1]?.url || ""]);
    setConsent(false);
    setSelected(null);
    setEditor("details");
    setError("");
  }
  async function report(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await guestbook.report(selected.id, reportReason);
      setSelected(null);
      setReporting(false);
      setNotice(
        demo
          ? "Demo report checked. No report was sent."
          : "Report submitted for review.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      const url = new URL(location.href);
      url.hash = page ? `page=${encodeURIComponent(page.id)}` : "";
      await navigator.clipboard.writeText(url.toString());
      setNotice(
        demo
          ? "Link copied. Demo signatures are only visible in this session."
          : "Link copied.",
      );
    } catch {
      setNotice("Copy this page’s address from your browser to share it.");
    }
  }
  useEffect(() => {
    const id = new URLSearchParams(location.hash.slice(1)).get("page");
    if (id) {
      const index = data.pages.findIndex((p) => p.id === id);
      if (index >= 0) setPageIndex(index);
    }
  }, [data.pages]);
  return (
    <>
      <a className="skip" href="#card">
        Skip to the card
      </a>
      <header className="header">
        <a className="brand" href="#" aria-label="You Were Here home">
          You Were Here<span>DevDay Community · DelhiNCR</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#card" className="active">
            The card
          </a>
          <button onClick={() => setAbout(true)}>About</button>
        </nav>
        <div className="header-actions">
          {!demo && data.signedIn && (
            <button
              className="icon"
              aria-label="Your signatures"
              onClick={() => setMine(true)}
            >
              <PencilSimple size={20} />
            </button>
          )}
          <button
            className="search-button"
            onClick={() => setSearch(true)}
            aria-label="Search names and handles"
          >
            <MagnifyingGlass size={20} />
            <span>Find a name or @handle</span>
          </button>
          <button
            className="icon share"
            aria-label="Share this card"
            onClick={share}
          >
            <ShareNetwork size={21} />
          </button>
          {!demo && data.signInPath && !data.signedIn ? (
            <a
              className="primary desktop-add"
              href={data.signInPath}
              target="_top"
            >
              Sign in to add yours
            </a>
          ) : (
            <button
              className="primary desktop-add"
              onClick={begin}
              disabled={!page || !!editor || !!flip}
            >
              <Plus size={17} />
              Add yours
            </button>
          )}
        </div>
      </header>
      <div className="mode-banner" role="note">
        {demo ? (
          <>
            <span className="badge">DEMO</span>Try the card. Signatures stay in
            this tab and disappear on refresh. No event attendees are shown.
          </>
        ) : (
          <>Shared community card · Your published name and links are public.</>
        )}
      </div>
      <main>
        <section className="hero" aria-labelledby="title">
          <div className="eyebrow">A LITTLE MOMENT. A SHARED MEMORY.</div>
          <h1 id="title">
            You Were <br />
            <span>Here.</span>
          </h1>
          <p>
            A room full of builders.
            <br />A card full of connections.
          </p>
          <p className="subcopy">
            Leave your signature, find a familiar name, and keep the DelhiNCR
            community close.
          </p>
          <a className="hero-link" href="#card">
            Make your mark <ArrowDown size={18} />
          </a>
          <div className="event-note">
            DevDay Community
            <br />
            <strong>DelhiNCR</strong>
          </div>
        </section>
        <section
          className="card-section"
          aria-label="Community signature tent card"
        >
          <div className="card-caption">
            <span>{demo ? "THE DEMO CARD" : "THE COMMUNITY CARD"}</span>
            <span>Everyone leaves a little ink.</span>
          </div>
          {loading ? (
            <div className="load-state" role="status">
              Opening the card…
            </div>
          ) : loadError ? (
            <div className="load-state" role="alert">
              <h2>We couldn’t open the shared card.</h2>
              <p>{loadError}</p>
              <button className="secondary" onClick={refresh}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="tent">
                <div className="binding" aria-hidden="true">
                  {Array.from({ length: 11 }, (_, i) => (
                    <i key={i} />
                  ))}
                </div>
                <div className="card-stack" />
                <div
                  id="card"
                  ref={cardRef}
                  className={`card ${flip ? `flip-${flip}` : ""} ${editor === "position" ? "placing" : ""}`}
                  style={{ aspectRatio: artwork.aspectRatio }}
                  tabIndex={editor === "position" ? 0 : -1}
                  role="group"
                  aria-label={
                    editor === "position"
                      ? "Signature position. Use arrow keys to move, Shift for larger steps, Enter to choose."
                      : `Card page ${pageIndex + 1}`
                  }
                  onKeyDown={cardKey}
                  onClick={(e) => {
                    if (editor !== "position") return;
                    const b = e.currentTarget.getBoundingClientRect();
                    position({
                      x: (e.clientX - b.left) / b.width,
                      y: (e.clientY - b.top) / b.height,
                    });
                  }}
                >
                  {artwork.available ? (
                    <img
                      className="artwork"
                      src={artwork.src}
                      alt="Original DevDay Community: DelhiNCR artwork. Hosted by Codex Ambassadors. Sign here + socials. Colorful circular glyph-face artwork. #DevDayCommunity #DevDayCommunityDelhi."
                      draggable={false}
                    />
                  ) : (
                    <div className="missing-art" role="note">
                      <Info size={24} />
                      <strong>Original artwork unavailable</strong>
                      <span>
                        The print artwork will appear here unchanged on every
                        page. Its Library download is currently blocked.
                      </span>
                    </div>
                  )}
                  {signatures
                    .filter((s) => s.id !== editingId)
                    .map((s) => (
                      <button
                        key={s.id}
                        className={`signature font-${s.font}`}
                        style={{
                          left: `${s.position.x * 100}%`,
                          top: `${s.position.y * 100}%`,
                          width: `${signatureWidth(s.name) * 100}%`,
                          color: s.ink,
                        }}
                        aria-label={`${s.name}${demo ? " (demo)" : ""}. View signature and social links`}
                        onClick={(e) => {
                          if (editor) return;
                          e.stopPropagation();
                          setSelected(s);
                          setError("");
                          setReporting(false);
                        }}
                        disabled={!!editor}
                      >
                        <InkName name={s.name} font={s.font} />
                      </button>
                    ))}
                  {editor && (
                    <>
                      <div
                        className="writing-zone"
                        aria-hidden="true"
                        style={{
                          left: `${SAFE_ZONE.left * 100}%`,
                          top: `${SAFE_ZONE.top * 100}%`,
                          width: `${(SAFE_ZONE.right - SAFE_ZONE.left) * 100}%`,
                          height: `${(SAFE_ZONE.bottom - SAFE_ZONE.top) * 100}%`,
                        }}
                      />
                      <span
                        className={`signature draft font-${draft.font}`}
                        data-testid="signature-preview"
                        style={{
                          left: `${draft.position.x * 100}%`,
                          top: `${draft.position.y * 100}%`,
                          width: `${signatureWidth(draft.name || "Your name") * 100}%`,
                          color: draft.ink,
                        }}
                      >
                        <InkName
                          name={draft.name || "Your name"}
                          font={draft.font}
                        />
                      </span>
                    </>
                  )}
                </div>
                <div className="tent-foot" aria-hidden="true" />
              </div>
              <div className="page-controls">
                <button
                  className="page-button"
                  onClick={() => navigate(-1)}
                  disabled={pageIndex === 0 || !!editor || !!flip}
                  aria-label="Previous page"
                >
                  <ArrowUp size={21} />
                  <span>Previous</span>
                </button>
                <span className="page-number" aria-live="polite">
                  {String(pageIndex + 1).padStart(2, "0")}{" "}
                  <span>/ {String(data.pages.length).padStart(2, "0")}</span>
                </span>
                <button
                  className="page-button"
                  onClick={() => navigate(1)}
                  disabled={
                    pageIndex >= data.pages.length - 1 || !!editor || !!flip
                  }
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ArrowDown size={21} />
                </button>
              </div>
              <p className="browse-hint">Turn a page. Find a connection.</p>
            </>
          )}
        </section>
        <aside className="margin-note">
          <span className="handwritten">
            Good conversations
            <br />
            don’t end here.
          </span>
          <span>
            Made by the community,
            <br />
            for the community.
          </span>
        </aside>
      </main>
      <footer>
        <span>DevDay Community · DelhiNCR</span>
        <span>A shared memory, one signature at a time.</span>
        <button onClick={() => setAbout(true)}>
          Privacy &amp; community notes
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            className="icon"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {!editor && (
        <div className="mobile-cta">
          {!demo && data.signInPath && !data.signedIn ? (
            <a className="primary" href={data.signInPath} target="_top">
              Sign in to add yours
            </a>
          ) : (
            <button
              className="primary"
              onClick={begin}
              disabled={!page || !!flip}
            >
              <Plus size={19} />
              Add yours
            </button>
          )}
        </div>
      )}
      {(editor === "position" || editor === "preview") && (
        <div className="editor-bar" role="region" aria-label="Signature editor">
          <div>
            <strong>
              {editor === "position"
                ? "Choose your spot"
                : "Your signature, on this page"}
            </strong>
            <p>
              {editor === "position"
                ? "Tap an open spot. Or focus the card and use arrow keys."
                : demo
                  ? "This preview is private to your demo session."
                  : "Your name and social links will be public."}
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="editor-actions">
            <button className="text-button" onClick={cancel} disabled={busy}>
              Cancel
            </button>
            {editor === "preview" && (
              <>
                <button
                  className="secondary"
                  onClick={() => setEditor("position")}
                  disabled={busy}
                >
                  Move
                </button>
                <button
                  className="secondary"
                  onClick={() => setEditor("details")}
                  disabled={busy}
                >
                  Edit
                </button>
              </>
            )}
            {editor === "position" ? (
              <button className="primary" onClick={() => setEditor("details")}>
                Use this spot <Check size={18} />
              </button>
            ) : (
              <button
                className="primary"
                onClick={publish}
                disabled={busy || (!demo && !artworkReady)}
              >
                {busy ? "Saving…" : demo ? "Add to demo" : "Publish signature"}
              </button>
            )}
          </div>
          {!demo && !artworkReady && (
            <p className="error">
              Publishing awaits the original artwork and verified writing
              regions.
            </p>
          )}
        </div>
      )}
      {editor === "details" && (
        <Modal
          label="Add your signature"
          onClose={() => setEditor("position")}
          className="signing-sheet"
        >
          <p className="eyebrow">YOUR LITTLE MARK</p>
          <h2>{editingId ? "Edit your signature" : "Add yours"}</h2>
          <p className="muted">
            On page {pageIndex + 1}. Choose the ink that feels like you.
            {!demo &&
              " Organizers review new signatures before they appear publicly."}
          </p>
          <form onSubmit={preview}>
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              autoFocus
              value={draft.name}
              maxLength={28}
              required
              minLength={2}
              autoComplete="name"
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
            />
            <fieldset>
              <legend>Signature style</legend>
              <div className="font-options">
                {FONTS.map((f) => (
                  <button
                    type="button"
                    key={f}
                    className={`font-${f} ${draft.font === f ? "chosen" : ""}`}
                    aria-label={`${{ caveat: "Caveat", dancing: "Dancing Script", kalam: "Kalam" }[f]} signing style`}
                    aria-pressed={draft.font === f}
                    onClick={() => setDraft((d) => ({ ...d, font: f }))}
                  >
                    {
                      { caveat: "Caveat", dancing: "Dancing", kalam: "Kalam" }[
                        f
                      ]
                    }
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Ink color</legend>
              <div className="ink-options">
                {INKS.map((ink, i) => (
                  <button
                    type="button"
                    key={ink}
                    style={{ background: ink }}
                    className={draft.ink === ink ? "chosen" : ""}
                    aria-label={
                      ["Charcoal ink", "Blue ink", "Olive ink", "Plum ink"][i]
                    }
                    aria-pressed={draft.ink === ink}
                    onClick={() => setDraft((d) => ({ ...d, ink }))}
                  >
                    {draft.ink === ink && <Check size={16} color="white" />}
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="social-1">
              Social profiles <span className="muted">(optional, up to 2)</span>
            </label>
            {links.map((link, i) => (
              <input
                key={i}
                id={`social-${i + 1}`}
                aria-label={`Social profile URL ${i + 1}`}
                value={link}
                type="url"
                maxLength={200}
                placeholder={
                  i === 0
                    ? "https://github.com/your-handle"
                    : "Another profile URL"
                }
                onChange={(e) =>
                  setLinks((v) =>
                    v.map((s, j) => (j === i ? e.target.value : s)),
                  )
                }
              />
            ))}
            <p className="field-help">
              GitHub, LinkedIn, Instagram, X, Bluesky or mastodon.social.
            </p>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {demo
                  ? "I understand this is a temporary demo. In the shared version, my name and links will be public."
                  : "I understand my name and links will be publicly visible."}
              </span>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary form-submit" type="submit">
              Preview on this page <ArrowUpRight size={18} />
            </button>
            <button
              className="text-button full"
              type="button"
              onClick={() => setEditor("position")}
            >
              <ArrowUUpLeft size={16} />
              Back to position
            </button>
          </form>
        </Modal>
      )}
      {search && (
        <Modal label="Search signatures" onClose={() => setSearch(false)}>
          <p className="eyebrow">FIND A FAMILIAR NAME</p>
          <h2>Who were you here with?</h2>
          <label htmlFor="query">Name or handle</label>
          <input
            id="query"
            type="search"
            autoFocus
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the card…"
          />
          <div className="search-results" aria-live="polite">
            {!query.trim() ? (
              <p className="muted">
                {demo
                  ? "Search “Demo” to explore the sample signatures."
                  : "Enter a name or social handle."}
              </p>
            ) : findSignatures(data.signatures, query).length === 0 ? (
              <p>No matching signatures.</p>
            ) : (
              findSignatures(data.signatures, query).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (editor) {
                      setNotice(
                        "Finish or cancel your signature before navigating.",
                      );
                      return;
                    }
                    setPageIndex(
                      data.pages.findIndex((p) => p.id === s.pageId),
                    );
                    setSearch(false);
                    setSelected(s);
                  }}
                >
                  <span className={`font-${s.font}`}>{s.name}</span>
                  <small>
                    Page {data.pages.findIndex((p) => p.id === s.pageId) + 1}
                    {demo ? " · Demo" : ""}
                  </small>
                  <ArrowUpRight size={18} />
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          label={`${selected.name} signature`}
          onClose={() => {
            setSelected(null);
            setReporting(false);
            setError("");
          }}
          className="signature-dialog"
        >
          <p className="eyebrow">
            {demo
              ? "DEMO SIGNATURE"
              : selected.status === "pending"
                ? "PRIVATE · AWAITING REVIEW"
                : selected.status === "rejected"
                  ? "PRIVATE · NEEDS CHANGES"
                  : "A COMMUNITY CONNECTION"}
          </p>
          <h2
            className={`font-${selected.font}`}
            style={{ color: selected.ink }}
          >
            {selected.name}
          </h2>
          {selected.socials.length ? (
            selected.socials.map((s) => (
              <a
                className="social-link"
                key={s.url}
                href={safeSocial(s.url)?.url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
              >
                {s.label}
                <ArrowUpRight size={18} />
              </a>
            ))
          ) : (
            <p className="muted">No social links added.</p>
          )}
          {isOwned(selected.id) && (
            <div className="owner-actions">
              <button className="secondary" onClick={edit}>
                <PencilSimple size={17} />
                Edit yours
              </button>
              <button className="secondary" onClick={remove} disabled={busy}>
                <Trash size={17} />
                Remove yours
              </button>
            </div>
          )}
          {selected.status !== "pending" &&
            selected.status !== "rejected" &&
            (!reporting ? (
              <button
                className="text-button"
                onClick={() => {
                  setReporting(true);
                  setReportReason("");
                }}
              >
                <Flag size={16} />
                Report a concern
              </button>
            ) : (
              <form onSubmit={report}>
                <label htmlFor="reason">What should be reviewed?</label>
                <textarea
                  id="reason"
                  required
                  minLength={5}
                  maxLength={500}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                />
                <p className="field-help">
                  {demo
                    ? "Demo only. This will not send a report."
                    : "Your report is sent privately to the moderation team."}
                </p>
                <button className="secondary" disabled={busy}>
                  {demo ? "Try demo report" : "Submit report"}
                </button>
              </form>
            ))}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {mine && (
        <Modal label="Your signatures" onClose={() => setMine(false)}>
          <p className="eyebrow">YOUR MARKS</p>
          <h2>Your signatures</h2>
          <p className="muted">
            Pending and rejected signatures are private to you and organizers.
          </p>
          <div className="search-results">
            {data.ownSignatures?.length ? (
              data.ownSignatures.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (editor) {
                      setNotice(
                        "Finish or cancel your current signature first.",
                      );
                      return;
                    }
                    setPageIndex(
                      data.pages.findIndex((p) => p.id === s.pageId),
                    );
                    setSelected(s);
                    setMine(false);
                    setError("");
                    setReporting(false);
                  }}
                >
                  <span className={`font-${s.font}`}>{s.name}</span>
                  <small>
                    {s.status === "pending"
                      ? "Awaiting review"
                      : s.status === "rejected"
                        ? "Needs changes"
                        : "Public"}{" "}
                    · Page {data.pages.findIndex((p) => p.id === s.pageId) + 1}
                  </small>
                  <ArrowUpRight size={18} />
                </button>
              ))
            ) : (
              <p>No signatures yet.</p>
            )}
          </div>
        </Modal>
      )}
      {about && (
        <Modal label="About You Were Here" onClose={() => setAbout(false)}>
          <p className="eyebrow">A SHARED MEMORY</p>
          <h2>You Were Here.</h2>
          <p>
            A signature tent card for DevDay Community DelhiNCR. Browse up and
            down, find a name, or add your own mark on the current page.
          </p>
          <h3>Leave a kind mark</h3>
          <p>
            Only add your own name and social profiles. Keep it welcoming. Names
            and links in the shared version are public; use the report action
            for a concern.
          </p>
          <h3>Your signature, your choice</h3>
          <p>
            {demo
              ? "This demo runs in memory. Nothing is publicly published or saved, and refreshing clears your additions. You can edit or remove additions during this session."
              : "Sign in with the same ChatGPT account to edit or remove your signature on another visit or device. New signatures and edits need organizer approval before they appear publicly."}
          </p>
          <h3>From the original cards</h3>
          <p>
            Original event photos have not been imported. Future transcriptions
            will retain their source card and require review before publication.
          </p>
          <p className="field-help">
            A community project. No official OpenAI endorsement is implied.
          </p>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
