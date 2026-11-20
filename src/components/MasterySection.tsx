import Link from "next/link";
import { formatDate } from "@/lib/client/format";
import { scopeQuery } from "@/lib/client/scope";
import type { DashboardView } from "@/lib/client/types";
import { getMasteryGuide } from "@/lib/domain/mastery";
import { Panel } from "./Primitives";

const guide = getMasteryGuide();
const disciplineNames = { backend: "Backend", frontend: "Frontend", ai: "AI engineering", systems: "Systems", qa: "QA and reliability", documentation: "Documentation", review: "Review" } as const;

export function MasterySection({ view, incomplete }: { view: DashboardView; incomplete: boolean }) {
  return (
    <Panel id="mastery" title="Monarch ascension" hint="Earned specialty achievements. The endgame after Rank S.">
      <p>Reach Rank {guide.requiredRank}, then demonstrate your specialty with {guide.requiredContributions} qualifying contributions across {guide.requiredDistinctMonths} distinct UTC calendar months in this view. Existing history counts.</p>
      <p className="small">These titles come from contribution evidence, not your Mage quiz. Self-reported Intelligence Monarch and earned specialty Monarchs are different accomplishments.</p>
      {view.mode === "demo" && <p className="notice small">Sample character progress, not your real achievements.</p>}
      {incomplete && view.mode === "live" && <p className="warn small">History is incomplete. Requirements and dates may change as more evidence is imported.</p>}
      {view.mastery.length === 0 ? <p className="small">Specialty progress is not available in this snapshot.</p> : (
        <ul className="mastery-list">
          {view.mastery.map((item) => (
            <li key={item.id} className={`mastery-card${item.unlockedAt ? " unlocked" : ""}`}>
              <div className="quest-top">
                <div><p className="caption">{disciplineNames[item.id]}</p><h3>{item.title}</h3></div>
                <span className="chip">{item.unlockedAt ? "Earned" : "Locked"}</span>
              </div>
              {item.unlockedAt && <p className="small">Unlocked {formatDate(item.unlockedAt)} from your contribution history.</p>}
              <ul className="mastery-gates" aria-label={`${item.title} requirements`}>
                <li className={item.rankGate.met ? "met" : ""}>{item.rankGate.met ? "✓" : "○"} Rank {item.rankGate.required}{!item.rankGate.met && ` (currently ${view.rank})`}</li>
                <li className={item.contributionGate.remaining === 0 ? "met" : ""}>{item.contributionGate.remaining === 0 ? "✓" : "○"} {item.contributionGate.current} / {item.contributionGate.required} contributions{item.contributionGate.remaining > 0 && ` · ${item.contributionGate.remaining} to go`}</li>
                <li className={item.monthGate.remaining === 0 ? "met" : ""}>{item.monthGate.remaining === 0 ? "✓" : "○"} {item.monthGate.current} / {item.monthGate.required} months{item.monthGate.remaining > 0 && ` · ${item.monthGate.remaining} to go`}</li>
              </ul>
              <details className="more">
                <summary>Qualifying work and evidence for {item.title}</summary>
                <p className="small">{guide.disciplines.find((definition) => definition.id === item.id)?.unlock}</p>
                {item.evidence.length > 0 ? <ul className="evidence" aria-label={`${item.title} evidence`}>
                  {item.evidence.map((evidence) => <li key={evidence.id}><a href={evidence.url} target="_blank" rel="noopener noreferrer">{evidence.title}</a></li>)}
                </ul> : <p className="small">No qualifying evidence links in this view yet.</p>}
                {item.unlinked > 0 && <p className="warn small">{item.unlinked} supporting evidence link{item.unlinked === 1 ? " is" : "s are"} unavailable in this snapshot.</p>}
              </details>
            </li>
          ))}
        </ul>
      )}
      <p className="small">Specialty signals use contribution metadata, not a code-quality assessment. These game milestones do not certify professional mastery.</p>
      <Link className="guide-link" href={`/about${scopeQuery(view.scope)}#mastery`}>Read the earned Monarch rules</Link>
    </Panel>
  );
}
