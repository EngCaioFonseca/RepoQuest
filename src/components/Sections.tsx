import { describeCoverage, isIncomplete, reasonText } from "@/lib/client/coverage";
import { formatDate, formatXp } from "@/lib/client/format";
import type { AchievementView, ContributionView, RepoView, TrackView } from "@/lib/client/types";
import { Empty, Meter, Panel } from "./Primitives";

const TRACK_META = {
  engineering: { name: "Engineering", glyph: "⚔", blurb: "Merged code and fixes" },
  documentation: { name: "Documentation", glyph: "✎", blurb: "Docs and guides" },
  review: { name: "Review", glyph: "◈", blurb: "Reviews that help others ship" },
} as const;

export function Tracks({ tracks }: { tracks: TrackView[] }) {
  const total = tracks.reduce((n, t) => n + t.xp, 0);
  return (
    <Panel id="tracks" title="Skill tracks" hint="Three independent paths, each with its own level.">
      <ul className="tracks">
        {tracks.map((t) => {
          const m = TRACK_META[t.id];
          return (
            <li key={t.id} className={`track track-${t.id}`}>
              <div className="track-top"><span className="glyph" aria-hidden="true">{m.glyph}</span><div><h3>{m.name}</h3><p className="hint">{m.blurb}</p></div><span className="lv">Lv {t.level}</span></div>
              <Meter value={t.xp} max={Math.max(total, 1)} label={`${m.name} share of total XP`} tone={t.id} />
              <p className="meta"><span>{formatXp(t.xp)} XP</span><span>{t.evidenceCount} evidence item{t.evidenceCount === 1 ? "" : "s"}</span><span>{total > 0 ? Math.round((t.xp / total) * 100) : 0}% of total XP</span></p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function Realms({ repos }: { repos: RepoView[] }) {
  return (
    <Panel id="realms" title="Repository realms" hint="Existing contribution history is imported per repository; coverage shows how much was read.">
      {repos.length === 0 ? <Empty title="No realms charted" body="Add repositories and press Sync to import your existing contribution history." /> : (
        <ul className="realms">
          {repos.map((r) => {
            const c = r.coverage; const d = describeCoverage(c);
            return (
              <li key={r.slug} className="realm">
                <div className="quest-top"><a href={r.url} target="_blank" rel="noopener noreferrer">{r.slug}</a><span className={`chip cov cov-${d.tone}`}>{d.label}</span></div>
                <p className="meta"><span>{r.evidenceCount} contribution{r.evidenceCount === 1 ? "" : "s"}</span><span>{formatXp(r.xp)} XP{isIncomplete(c) ? " (provisional)" : ""}</span></p>
                <p className="small">{d.detail}</p>
                <dl className="cov-grid">
                  <div><dt>Earliest evidence</dt><dd>{formatDate(c.oldestEvidenceAt)}</dd></div>
                  <div><dt>Latest evidence</dt><dd>{formatDate(c.newestEvidenceAt)}</dd></div>
                  <div><dt>History read through</dt><dd>{c.coveredThrough ? formatDate(c.coveredThrough) : "not complete"}</dd></div>
                  <div><dt>Last successful sync</dt><dd>{formatDate(c.lastSuccessfulSyncAt)}</dd></div>
                </dl>
                {reasonText(c) && <p className="warn small">Reason: {reasonText(c)}.{c.retryAt ? ` Retry after ${formatDate(c.retryAt)}.` : ""}</p>}
                {c.canResume && c.backfillStatus !== "complete" && <p className="small">Sync again to resume where the import stopped.</p>}
                {c.limitations.length > 0 && <ul className="limits warn small" aria-label={`Limitations for ${r.slug}`}>{c.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function Journal({ items }: { items: AchievementView[] }) {
  const unlocked = items.filter((a) => a.unlocked).length;
  return (
    <Panel id="journal" title="Achievement journal" hint={items.length ? `${unlocked} of ${items.length} unlocked` : undefined}>
      {items.length === 0 ? <Empty title="Journal is blank" body="Achievements will appear after the first snapshot." /> : (
        <ul className="journal">
          {items.map((a) => (
            <li key={a.id} className={`ach ${a.unlocked ? "on" : "off"}`}>
              <div className="ach-top"><h3>{a.name}</h3><span className="chip">{a.unlocked ? `Unlocked ${formatDate(a.unlockedAt)}` : "Locked"}</span></div>
              <p className="small">{a.description}</p>
              {!a.unlocked ? <><Meter value={a.progress} max={a.target} label={`${a.name} progress`} /><p className="small">{a.progress} / {a.target}</p></> : null}
              {a.unlocked && a.missingEvidence > 0 && <p className="small warn">{a.missingEvidence} qualifying evidence item{a.missingEvidence === 1 ? " is" : "s are"} not available as a link.</p>}
              {a.evidence.length > 0 && (
                <>
                  <ul className="evidence" aria-label={`Evidence for ${a.name}`}>
                    {a.evidence.slice(0, 3).map((e) => <li key={e.url}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a></li>)}
                  </ul>
                  {a.evidence.length > 3 && (
                    <details className="more">
                      <summary>Show {a.evidence.length - 3} more evidence items for {a.name}</summary>
                      <ul className="evidence" aria-label={`More evidence for ${a.name}`}>
                        {a.evidence.slice(3).map((e) => <li key={e.url}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a></li>)}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Recent({ items, incomplete }: { items: ContributionView[]; incomplete: boolean }) {
  return (
    <Panel id="recent" title="Contribution evidence" hint="Original contribution dates. Evidence is kept separately from derived XP.">
      {items.length === 0 ? (
        <Empty title={incomplete ? "No evidence recovered yet" : "No contribution history found"}
          body={incomplete ? "History import is incomplete, so this does not mean you have no past contributions. Sync again to continue." : "Supported history was read for the selected repositories and contained no matching contributions."} />
      ) : (
        <ul className="recent">
          {items.slice(0, 30).map((c) => (
            <li key={c.id} className="contrib">
              <span className={`dot dot-${c.track}`} aria-hidden="true" />
              <div>
                {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title}</a> : <span>{c.title}</span>}
                <p className="meta"><span>{c.kind}, {c.state}</span><span>{c.repo}</span><span>{formatDate(c.occurredAt)}</span><span>{c.track}</span></p>
                <p className="small">{c.reason}</p>
              </div>
              <span className="chip">+{c.xp} XP</span>
            </li>
          ))}
        </ul>
      )}
      {items.length > 30 && <p className="small">Showing the 30 most recent of {items.length} items.</p>}
    </Panel>
  );
}
