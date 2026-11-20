"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { downloadShareCard, fetchDashboard, runSync, savePreference, shareUrl } from "@/lib/client/api";
import { formatDate, formatXp } from "@/lib/client/format";
import { DEFAULT_REPOSITORIES } from "@/lib/contracts";
import { isIncomplete } from "@/lib/client/coverage";
import { ApiError, type DashboardView, type SyncSummary } from "@/lib/client/types";
import { GLOBAL, parseStoredScope, scopeLabel, scopeMatches, scopeQuery, type ScopeSel } from "@/lib/client/scope";
import { Meter, RankSigil } from "./Primitives";
import { setPanelOpen, setPanelsOpen } from "@/lib/client/panels";
import { ScopeSwitch } from "./ScopeSwitch";
import { ProfilePanel, type PrefDraft } from "./ProfilePanel";
import { ClassBadge, ClassSection } from "./ClassSection";
import { MasterySection } from "./MasterySection";
import { Journal, Realms, Recent, Tracks } from "./Sections";
import { Quests } from "./QuestSections";
import { SyncPanel, type SyncForm } from "./SyncPanel";

// Prefill is the requested real identity and the shared default repositories. It is form state only:
// a loaded snapshot (demo or live) never writes into it.
const DEFAULT_FORM: SyncForm = { username: "engcaiofonseca", repos: [...DEFAULT_REPOSITORIES] };
const STORE = "repoquest.form.v2"; // v2 drops older saved prefills (empty username, pre-redirect repo slugs)
const SCOPE_STORE = "repoquest.scope.v1"; // view preference only; never sent to sync
const PANEL_IDS = ["class", "profile", "tracks", "quests", "realms", "mastery", "journal", "recent", "sync"] as const;
const NAV = [["tracks", "Tracks"], ["realms", "Realms"], ["class", "Class"], ["mastery", "Monarchs"], ["quests", "Quests"], ["journal", "Journal"], ["recent", "Evidence"], ["sync", "Sync"]] as const;


export function Dashboard() {
  const [data, setData] = useState<DashboardView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncFields, setSyncFields] = useState<Record<string, string> | undefined>();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [form, setForm] = useState<SyncForm>(DEFAULT_FORM);
  const [menu, setMenu] = useState(false);
  const [scope, setScope] = useState<ScopeSel>(GLOBAL);
  const [scopeReady, setScopeReady] = useState(false);
  const [tracked, setTracked] = useState<string[]>([]);
  const reqId = useRef(0);
  const scopeRef = useRef<ScopeSel>(GLOBAL);

  useEffect(() => {
    let s = GLOBAL;
    try { s = parseStoredScope(localStorage.getItem(SCOPE_STORE)); } catch { /* storage unavailable */ }
    // A ?repository= link (for example back from the guide) wins over the saved preference.
    const fromUrl = new URLSearchParams(window.location.search).get("repository");
    if (fromUrl) s = parseStoredScope(JSON.stringify({ kind: "repository", repositoryId: fromUrl }));
    scopeRef.current = s; setScope(s); setScopeReady(true);
  }, []);
  const changeScope = (s: ScopeSel) => {
    scopeRef.current = s; setScope(s); setShareMsg(null);
    try { localStorage.setItem(SCOPE_STORE, JSON.stringify(s)); } catch { /* ignore */ }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const p = JSON.parse(raw) as Partial<SyncForm>;
        if (typeof p.username === "string" && Array.isArray(p.repos) && p.repos.every((r) => typeof r === "string") && p.repos.length > 0) setForm({ username: p.username, repos: p.repos });
      }
    } catch { /* storage unavailable */ }
  }, []);
  const updateForm = (f: SyncForm) => { setForm(f); try { localStorage.setItem(STORE, JSON.stringify(f)); } catch { /* ignore */ } };

  // Latest request wins; a slow response for a previous scope can never replace the current one.
  const load = useCallback(async (sel: ScopeSel) => {
    const id = ++reqId.current;
    setLoading(true); setLoadError(null);
    try {
      const v = await fetchDashboard(sel);
      if (id !== reqId.current) return;
      setData(v); setTracked(v.trackedRepositories);
    } catch (e) {
      if (id === reqId.current) setLoadError(e instanceof ApiError && e.code === "repository_not_tracked" ? `${sel.kind === "repository" ? sel.repositoryId : "This repository"} is not tracked. Add it under Sync and run a sync, or choose another view` : e instanceof Error ? e.message : "Unknown error");
    } finally { if (id === reqId.current) setLoading(false); }
  }, []);
  // Changing scope clears the old character first, so it is never shown under the new scope's name.
  useEffect(() => { if (!scopeReady) return; setData(null); void load(scope); }, [scope, scopeReady, load]);

  /** Re-reads the currently selected scope (POST /api/sync always answers with the global snapshot). */
  async function refresh(): Promise<string | null> {
    const id = ++reqId.current;
    try {
      const v = await fetchDashboard(scopeRef.current);
      if (id === reqId.current) { setData(v); setTracked(v.trackedRepositories); setLoadError(null); setLoading(false); }
      return null;
    } catch (e) { return e instanceof Error ? e.message : "Unknown error"; }
  }

  async function sync() {
    setSyncing(true); setSyncError(null); setSummary(null); setSyncFields(undefined); setRefreshError(null);
    try {
      const r = await runSync({ username: form.username.trim(), repositories: form.repos.map((x) => x.trim()).filter(Boolean) });
      setSummary(r.summary); setTracked(r.dashboard.trackedRepositories);
      setRefreshError(await refresh());
    } catch (e) {
      const retry = e instanceof ApiError && e.retryAt ? ` Try again after ${new Date(e.retryAt).toLocaleString()}.` : "";
      if (e instanceof ApiError) { setSyncFields(e.fields); if (e.fields) setPanelOpen("sync", true); }
      setSyncError((e instanceof ApiError && e.status === 429 ? `Rate limited: ${e.message}` : e instanceof Error ? e.message : "Sync failed") + retry);
      // Refresh so coverage the server recorded for the failed attempt is shown; the sync error stays visible.
      setRefreshError(await refresh());
    } finally { setSyncing(false); }
  }

  /** Resolves to a warning when the save succeeded but the refetch failed; throws only if the save itself failed. */
  async function savePrefs(draft: PrefDraft): Promise<string | null> {
    if (!view) return null;
    await savePreference(view.profile.username, draft);
    // Re-read the CURRENT scope so every view reflects the saved title; no GitHub sync happens.
    const err = await refresh();
    return err ? `Saved, but the dashboard could not be refreshed (${err}), so titles below may be out of date.` : null;
  }

  async function share() {
    setShareMsg(null);
    try { await downloadShareCard(scope); setShareMsg("Card downloaded."); } catch (e) { setShareMsg(e instanceof Error ? `Download failed: ${e.message}` : "Download failed"); }
  }

  // Only a snapshot the server derived for the selected scope is ever rendered.
  const view = data && scopeMatches(scope, data) ? data : null;
  const incomplete = Boolean(view?.repositories.some((r) => isIncomplete(r.coverage)));
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#top">Repo<span>Quest</span></a>
        <button className="btn ghost menu-btn" aria-expanded={menu} aria-controls="nav" onClick={() => setMenu(!menu)}>Menu</button>
        <nav id="nav" aria-label="Sections" className={menu ? "open" : ""}>
          {NAV.map(([id, label]) => <a key={id} href={`#${id}`} onClick={() => { setMenu(false); setPanelOpen(id, true); }}>{label}</a>)}
          <Link href={`/quests${scopeQuery(scope)}`} onClick={() => setMenu(false)}>Quest log</Link>
          <Link href={`/about${scopeQuery(scope)}`} onClick={() => setMenu(false)}>Guide</Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <span id="top" />
        {!view && <h1 className="sr">RepoQuest</h1>}
        <ScopeSwitch scope={scope} onChange={changeScope} repositories={tracked.length ? tracked : [...DEFAULT_REPOSITORIES]} busy={loading && !view} />
        {loading && !view && <div className="banner info" role="status"><span className="spinner" aria-hidden="true" /> Loading the {scopeLabel(scope)} character…</div>}
        {loadError && (
          <div className="banner error" role="alert">
            <strong>Could not load the {scopeLabel(scope)} character.</strong> {loadError}. Demo data is not substituted for failed requests.
            <button className="btn" onClick={() => void load(scope)}>Retry</button>
            {scope.kind === "repository" && <button className="btn ghost" onClick={() => changeScope(GLOBAL)}>Show Global</button>}
          </div>
        )}
        {syncing && <div className="banner info" role="status"><span className="spinner" aria-hidden="true" /> Importing existing contribution history for the selected repositories. Older work counts, so this can take a while.</div>}
        {syncError && <div className="banner error" role="alert"><strong>Sync failed.</strong> {syncError} Failed history is not treated as zero activity.{refreshError ? ` The dashboard could not be refreshed (${refreshError}), so the figures below may be out of date.` : " The dashboard below was refreshed from the server, so earned progress and repository coverage reflect what was saved."}</div>}
        {summary && !syncError && (
          <div className={`banner ${summary.partial ? "warn" : "live"}`} role="status">
            <strong>{summary.partial ? "Sync finished partially." : "Sync complete."}</strong> {summary.imported} new evidence item{summary.imported === 1 ? "" : "s"} recovered, {summary.unchanged} already counted.
            {summary.partial && " Some history could not be fully read, so progress is provisional."}
            {refreshError && " The dashboard could not be refreshed afterwards, so the figures may be out of date."}
            {summary.retryAt && ` Retry after ${new Date(summary.retryAt).toLocaleString()}.`}
            {summary.warnings.length > 0 && <ul>{summary.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}

        {view && (
          <>
            <div className={`banner ${view.mode === "demo" ? "demo" : "live"}`}>
              <strong>{view.mode === "demo" ? "DEMO DATA" : "LIVE DATA"}</strong>
              {view.mode === "demo"
                ? " — A sample character, not your real contributions. Run a sync to import your existing history."
                : ` — Imported from GitHub for @${view.profile.username}${view.lastSyncedAt ? `, last full sync ${formatDate(view.lastSyncedAt)}` : ", no fully completed sync yet (a partial import does not set this date; see each realm for its own last successful sync)"}.`}
            </div>
            {!view.liveSyncAvailable && <div className="banner info"><strong>Live sync is unavailable.</strong> The server has no GitHub token configured, so Sync is disabled. Configure a token on the server (it is never shown in the browser) and reload.</div>}
            {incomplete && view.mode === "live" && <div className="banner warn"><strong>Provisional progress.</strong> History import is not complete for every repository, so level, rank and XP may rise after the next sync. See each realm's coverage.</div>}
            {view.warnings.length > 0 && <div className="banner warn"><strong>Warnings.</strong><ul>{view.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}

            <section className="hero" aria-label="Character">
              <RankSigil rank={view.rank} />
              <div className="hero-main">
                <p className="caption">{view.scope.kind === "global" ? "Global character: all tracked repositories." : `Repository character: ${view.scope.repositoryId}, from your contributions there only.`} Local rank {view.rank}, a personal game score, not a verified skill or public ranking.</p>
                <h1>{view.profile.displayName}</h1>
                <p className="hero-title">{view.title}{view.title !== view.earnedTitle && <span className="chip self">Mage: self-reported</span>}</p>
                <ClassBadge view={view} />
                <div className="xp-line"><span className="lvl">Level<b>{view.level}</b></span><span className="small">{formatXp(view.levelXp)} / {formatXp(view.nextLevelXp)} XP this level, {formatXp(view.totalXp)} total{incomplete && view.mode === "live" ? " (provisional)" : ""}</span></div>
                <Meter value={view.levelXp} max={view.nextLevelXp} label="Level progress" />
                {view.nextRankRequirement && <p className="small">Next rank: {view.nextRankRequirement}</p>}
                {view.titles.length > 0 && <ul className="titles" aria-label="Earned titles">{view.titles.map((t) => <li key={t} className="chip">{t}</li>)}</ul>}
              </div>
              <div className="hero-actions">
                <button className="btn primary" onClick={() => void share()}>Download card (SVG)</button>
                <a className="btn" href={shareUrl(scope)} target="_blank" rel="noopener noreferrer">Preview card</a>
                <Link className="guide-link" href={`/about${scopeQuery(scope)}`}>Why this rank? Read the progression guide</Link>
                <p className="small" role="status">{shareMsg ?? "Cards exclude credentials and private details."}</p>
              </div>
            </section>

            <div className="panel-tools" role="group" aria-label="Dashboard sections">
              <button type="button" className="btn ghost" onClick={() => setPanelsOpen(PANEL_IDS, true)}>Expand all</button>
              <button type="button" className="btn ghost" onClick={() => setPanelsOpen(PANEL_IDS, false)}>Collapse all</button>
            </div>
            <div className="grid">
              <div className="col">
                <ClassSection view={view} />
                <ProfilePanel view={view} onSave={savePrefs} />
                <Tracks tracks={view.tracks} />
                <Quests quests={view.quests} log={view.questLog} logHref={`/quests${scopeQuery(scope)}`} />
                <Realms repos={view.repositories} />
              </div>
              <div className="col">
                <MasterySection view={view} incomplete={incomplete} />
                <Journal items={view.achievements} />
                <Recent items={view.contributions} incomplete={incomplete} />
              </div>
            </div>
          </>
        )}

        <SyncPanel form={form} onChange={updateForm} onSync={() => void sync()} syncing={syncing} serverFields={syncFields} firstSync={view?.mode !== "live"} disabled={view ? !view.liveSyncAvailable : false} storage={view?.storage} />
      </main>
      <footer className="foot small">RepoQuest runs locally. Ranks and levels are a personal game layer over public contribution evidence.</footer>
    </div>
  );
}
