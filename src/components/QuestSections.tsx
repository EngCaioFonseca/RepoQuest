import Link from "next/link";
import { formatDate, formatXp } from "@/lib/client/format";
import type { CompletedQuestView, QuestLogView, QuestView, Relic, Renown } from "@/lib/client/types";
import { Empty, Meter } from "./Primitives";

const RARITY_ORDER: Relic["rarity"][] = ["legendary", "epic", "rare", "uncommon", "common"];
const RARITY_LABEL: Record<Relic["rarity"], string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

export function RelicBadge({ relic, compact = false }: { relic: Relic; compact?: boolean }) {
  return (
    <span className={`relic rarity-${relic.rarity}${compact ? " compact" : ""}`} title={relic.description}>
      <span className="relic-icon" aria-hidden="true">{relic.icon}</span>
      <span className="relic-name">{relic.name}</span>
      {!compact && <span className="relic-rarity">{RARITY_LABEL[relic.rarity]}</span>}
    </span>
  );
}

export function RenownBar({ renown }: { renown: Renown }) {
  return (
    <div className="renown">
      <p className="renown-line"><b>{renown.rank}</b> <span className="small">{renown.points} renown{renown.nextRank ? `, ${renown.nextRankPoints! - renown.points} to ${renown.nextRank}` : ", highest renown reached"}</span></p>
      {renown.nextRankPoints !== null && <Meter value={renown.points} max={renown.nextRankPoints} label="Renown progress" />}
    </div>
  );
}

export function QuestCard({ quest }: { quest: QuestView }) {
  const left = quest.target - quest.progress;
  return (
    <li className={`quest${quest.recommendation ? " suggested" : ""}${quest.completed ? " done" : ""}`}>
      <div className="quest-top">
        <div>
          <p className="caption">{quest.chainId === "bounty" ? `Bounty, open through ${quest.endsAt ? formatDate(new Date(Date.parse(quest.endsAt) - 1).toISOString()) : "this month"}` : `Tier ${quest.tier}`}</p>
          <h3>{quest.title}</h3>
        </div>
        <span className="chip">{quest.completed ? "Claimed" : quest.rewardXp > 0 ? `~${formatXp(quest.rewardXp)} XP` : `${left} to go`}</span>
      </div>
      <p className="small">{quest.description}</p>
      <Meter value={quest.progress} max={quest.target} label={`${quest.title} progress`} tone={quest.track} />
      <p className="small quest-reward">{quest.completed ? "Reward claimed:" : "Reward:"} <RelicBadge relic={quest.reward} /></p>
      {quest.recommendation && <p className="small suggest">★ {quest.recommendation}</p>}
    </li>
  );
}

/** Dashboard panel: the live board plus a glance at recent rewards. */
export function Quests({ quests, log, logHref }: { quests: QuestView[]; log: QuestLogView; logHref: string }) {
  const recent = [...log.completed].reverse().slice(0, 3);
  return (
    <section className="panel" id="quests" aria-labelledby="quests-h">
      <header className="panel-head quest-head">
        <div>
          <h2 id="quests-h">Quests</h2>
          <p className="hint">Questlines never run out: finishing a tier opens the next one. XP still comes only from imported evidence.</p>
        </div>
        <Link className="btn" href={logHref}>Quest log ({log.completed.length})</Link>
      </header>
      <RenownBar renown={log.renown} />
      {quests.length === 0 ? <Empty title="No active quests" body="Quests appear once a snapshot is available." /> : (
        <ul className="quests">{quests.map((q) => <QuestCard key={q.id} quest={q} />)}</ul>
      )}
      {recent.length > 0 && (
        <div className="recent-rewards">
          <h3>Latest rewards</h3>
          <ul>{recent.map((q) => <li key={q.id}><RelicBadge relic={q.reward} compact /> <span className="small">{q.title}, {formatDate(q.completedAt)}</span></li>)}</ul>
        </div>
      )}
    </section>
  );
}

function CompletedQuestItem({ quest }: { quest: CompletedQuestView }) {
  return (
    <li className="quest done">
      <div className="quest-top">
        <div>
          <p className="caption">{quest.chainId === "bounty" ? "Monthly bounty" : `Tier ${quest.tier}`} · {formatDate(quest.completedAt)}</p>
          <h3>{quest.title}</h3>
        </div>
        <RelicBadge relic={quest.reward} />
      </div>
      <p className="small">{quest.description}</p>
      {quest.evidence.length > 0 && (
        <details className="more">
          <summary>Evidence ({quest.evidence.length + quest.missingEvidence})</summary>
          <ul className="evidence" aria-label={`Evidence for ${quest.title}`}>
            {quest.evidence.map((e) => <li key={e.url}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a></li>)}
          </ul>
        </details>
      )}
      {quest.missingEvidence > 0 && <p className="small warn">{quest.missingEvidence} qualifying evidence item{quest.missingEvidence === 1 ? " is" : "s are"} not available as a link.</p>}
    </li>
  );
}

/** Full-page arsenal plus completed quests grouped by the level they were finished at. */
export function QuestLogBody({ quests, log }: { quests: QuestView[]; log: QuestLogView }) {
  const byLevel = new Map<number, CompletedQuestView[]>();
  for (const quest of log.completed) {
    const bucket = byLevel.get(quest.levelAtCompletion) ?? [];
    bucket.push(quest);
    byLevel.set(quest.levelAtCompletion, bucket);
  }
  const levels = [...byLevel.keys()].sort((a, b) => b - a);
  const rarityCount = (r: Relic["rarity"]) => log.completed.filter((q) => q.reward.rarity === r).length;
  return (
    <>
      <section className="panel" id="arsenal" aria-labelledby="arsenal-h">
        <header className="panel-head">
          <h2 id="arsenal-h">Arsenal</h2>
          <p className="hint">{log.completed.length} relic{log.completed.length === 1 ? "" : "s"} collected. {RARITY_ORDER.map((r) => `${rarityCount(r)} ${RARITY_LABEL[r].toLowerCase()}`).join(", ")}. Relics are trophies: they never add XP or change rank.</p>
        </header>
        <RenownBar renown={log.renown} />
        {log.completed.length === 0 ? <Empty title="The arsenal is empty" body="Complete any quest to earn your first relic." /> : (
          <ul className="arsenal">{[...log.completed].reverse().sort((a, b) => RARITY_ORDER.indexOf(a.reward.rarity) - RARITY_ORDER.indexOf(b.reward.rarity)).map((q) => <li key={q.id}><RelicBadge relic={q.reward} /></li>)}</ul>
        )}
      </section>

      <section className="panel" id="active" aria-labelledby="active-h">
        <header className="panel-head"><h2 id="active-h">Active quests</h2><p className="hint">Next tier of every questline, plus this month&apos;s bounty.</p></header>
        <ul className="quests">{quests.map((q) => <QuestCard key={q.id} quest={q} />)}</ul>
      </section>

      <section className="panel" id="completed" aria-labelledby="completed-h">
        <header className="panel-head"><h2 id="completed-h">Completed quests by level</h2><p className="hint">Replayed from your evidence in date order. Each group is the character level you held right after the quest was completed.</p></header>
        {levels.length === 0 ? <Empty title="No quests completed yet" body="Sync your history or land a contribution to complete your first quest." /> : levels.map((level) => (
          <div key={level} className="level-group">
            <h3 className="level-head">Level {level} <span className="small">{byLevel.get(level)!.length} quest{byLevel.get(level)!.length === 1 ? "" : "s"}</span></h3>
            <ul className="quests">{[...byLevel.get(level)!].reverse().map((q) => <CompletedQuestItem key={q.id} quest={q} />)}</ul>
          </div>
        ))}
      </section>
    </>
  );
}
