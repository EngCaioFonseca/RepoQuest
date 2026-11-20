"use client";
import { useEffect, useState } from "react";
import { fetchDashboard } from "@/lib/client/api";
import { formatXp } from "@/lib/client/format";
import { scopeLabel, type ScopeSel } from "@/lib/client/scope";
import type { DashboardView } from "@/lib/client/types";
import { RankSigil } from "./Primitives";

/** Read-only look at the current scoped character. Never syncs. */
export function CurrentCharacter({ scope }: { scope: ScopeSel }) {
  const [view, setView] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = scope.kind === "global" ? "global" : scope.repositoryId;

  useEffect(() => {
    let live = true;
    setView(null); setError(null);
    fetchDashboard(scope).then((v) => live && setView(v), (e: unknown) => live && setError(e instanceof Error ? e.message : "Unknown error"));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (error) return <div className="banner error" role="alert"><strong>Your current character is unavailable.</strong> {error}. The rules below still apply.</div>;
  if (!view) return <div className="banner info" role="status"><span className="spinner" aria-hidden="true" /> Loading the {scopeLabel(scope)} character…</div>;
  return (
    <div className="you">
      <RankSigil rank={view.rank} />
      <div>
        <p className="caption">{view.scope.kind === "global" ? "Your Global character" : `Your ${view.scope.repositoryId} character`}{view.mode === "demo" ? ", from demo data (not your real contributions)" : ""}</p>
        <p className="you-line"><b>{view.title}</b>. Level {view.level}, rank {view.rank}, {formatXp(view.totalXp)} XP.</p>
        {view.preference.mageActive && <p className="small"><span className="chip self">Mage{view.preference.magePath ? ` — ${view.preference.magePath.name}` : ""}: self-reported</span></p>}
        <p className="small">{view.characterClass ? `Class: ${view.characterClass.name} (${view.characterClass.state}).` : "Class unavailable."}</p>
        <p className="small">{view.nextRankRequirement ? `Next rank: ${view.nextRankRequirement}` : "No higher rank to reach."}</p>
      </div>
    </div>
  );
}
