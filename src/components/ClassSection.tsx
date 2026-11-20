import { getClassGuide } from "@/lib/domain/classes";
import type { CharacterClassId } from "@/lib/contracts";
import { isIncomplete } from "@/lib/client/coverage";
import type { ClassEvidenceView, DashboardView } from "@/lib/client/types";
import { Empty, Panel } from "./Primitives";

export const CLASS_GLYPH: Record<CharacterClassId, string> = { adventurer: "⚑", healer: "✚", warrior: "⚔", mage: "✦", scribe: "✎", guardian: "⛨" };

const guide = getClassGuide();
const className = (id: CharacterClassId): string => guide.classes.find((c) => c.id === id)?.name ?? id;
const stateMeaning = (state: string): string => guide.stateRules.find((r) => r.state === state)?.meaning ?? "";
const STATE_LABEL: Record<string, string> = { provisional: "Provisional", specialized: "Specialized", hybrid: "Hybrid", ambiguous: "Ambiguous" };

function EvidenceLinks({ items, label, unlinked }: { items: ClassEvidenceView[]; label: string; unlinked: number }) {
  const row = (e: ClassEvidenceView) => (
    <li key={e.id}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title}</a>{e.reason && <span className="small"> {e.reason}</span>}</li>
  );
  return (
    <>
      {items.length > 0 && <ul className="class-ev" aria-label={label}>{items.slice(0, 3).map(row)}</ul>}
      {items.length > 3 && (
        <details className="more">
          <summary>Show {items.length - 3} more evidence items for {label}</summary>
          <ul className="class-ev" aria-label={`More: ${label}`}>{items.slice(3).map(row)}</ul>
        </details>
      )}
      {unlinked > 0 && <p className="small warn">{unlinked} supporting item{unlinked === 1 ? " has" : "s have"} no available link.</p>}
    </>
  );
}

/** Class identity chip for the hero. */
export function ClassBadge({ view }: { view: DashboardView }) {
  const c = view.characterClass;
  if (!c) return null;
  return (
    <p className={`class-line class-${c.id}`}>
      <span className="class-glyph" aria-hidden="true">{CLASS_GLYPH[c.id]}</span>
      <a href="#class"><strong>{c.name}</strong></a>
      <span className="chip">{STATE_LABEL[c.state] ?? c.state}</span>
    </p>
  );
}

export function ClassSection({ view }: { view: DashboardView }) {
  const c = view.characterClass;
  if (!c) return <Panel id="class" title="Class"><Empty title="Class unavailable" body="The server did not send a class for this view, so none is shown." /></Panel>;
  const partial = view.repositories.some((r) => isIncomplete(r.coverage));
  const scopeText = view.scope.kind === "global" ? "all tracked repositories" : view.scope.repositoryId;
  return (
    <Panel id="class" title="Class" hint={`Role your contributions point to in ${scopeText}.`}>
      <div className={`class-head class-${c.id}`}>
        <span className="class-seal" aria-hidden="true">{CLASS_GLYPH[c.id]}</span>
        <div>
          <h3>{c.name} <span className="chip">{STATE_LABEL[c.state] ?? c.state}</span></h3>
          <p>{c.summary}</p>
          <p className="small">{stateMeaning(c.state)}</p>
        </div>
      </div>

      <p className="notice small">
        A heuristic from contribution titles, kinds and tracks, not from reading code. It describes the work in this view, not the tools you used or your job.
        {view.mode === "demo" && " This is a sample character, so the class is not yours."}
        {partial && " History import is incomplete, so this class may change after the next sync."}
      </p>

      {view.preference.mageActive && <p className="small">Mage appears in your title because you reported it. It is self-reported, not detected from your contributions, and it is not part of this class mix.</p>}

      {c.qualifying === 0 ? (
        <Empty title="No qualifying evidence in this view" body="Adventurer is the neutral class. Contributions in this view will add class votes." />
      ) : (
        <>
          <h3 className="sub">Class mix</h3>
          <div className="mixbar" role="img" aria-label={`Class mix: ${c.mix.map((m) => `${className(m.classId)} ${Math.round(m.share * 100)}%`).join(", ")}`}>
            {c.mix.map((m) => <span key={m.classId} className={`seg class-${m.classId}`} style={{ flexGrow: Math.max(m.share, 0.02) }} />)}
          </div>
          <ul className="mix">
            {c.mix.map((m) => (
              <li key={m.classId} className={`mix-row class-${m.classId}`}>
                <div className="quest-top"><h4><span className="class-glyph" aria-hidden="true">{CLASS_GLYPH[m.classId]}</span> {className(m.classId)}</h4><span className="chip">{Math.round(m.share * 100)}%, {m.evidenceCount} contribution{m.evidenceCount === 1 ? "" : "s"}</span></div>
                <EvidenceLinks items={m.evidence} label={`${className(m.classId)} evidence`} unlinked={m.unlinked} />
              </li>
            ))}
          </ul>

          <h3 className="sub">Specialties</h3>
          {c.specialties.length === 0 ? <p className="small">No technical specialty stood out in this view.</p> : (
            <ul className="specs">
              {c.specialties.map((p) => (
                <li key={p.id} className="spec">
                  <div className="quest-top"><h4>{p.label}</h4><span className="chip">{p.evidence.length + p.unlinked} contribution{p.evidence.length + p.unlinked === 1 ? "" : "s"}</span></div>
                  <p className="small">{p.explanation}</p>
                  <EvidenceLinks items={p.evidence} label={`${p.label} evidence`} unlinked={p.unlinked} />
                </li>
              ))}
            </ul>
          )}
          <p className="small">{c.qualifying} qualifying contribution{c.qualifying === 1 ? "" : "s"} counted{c.rejected > 0 ? `, ${c.rejected} did not qualify` : ""}. Classifier {c.classifierVersion}.</p>
        </>
      )}
      {c.limits.length > 0 && <ul className="limits small" aria-label="Classification limits">{c.limits.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      <p className="small"><a href={`/about${view.scope.kind === "repository" ? `?repository=${encodeURIComponent(view.scope.repositoryId)}` : ""}#classes`}>How classes are decided</a></p>
    </Panel>
  );
}
