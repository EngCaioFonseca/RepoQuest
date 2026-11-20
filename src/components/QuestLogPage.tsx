"use client";
import { useEffect, useState } from "react";
import { fetchDashboard } from "@/lib/client/api";
import { scopeLabel, type ScopeSel } from "@/lib/client/scope";
import type { DashboardView } from "@/lib/client/types";
import { QuestLogBody } from "./QuestSections";

/** Read-only quest history for the scoped character. Never syncs. */
export function QuestLogPage({ scope }: { scope: ScopeSel }) {
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

  if (error) return <div className="banner error" role="alert"><strong>The {scopeLabel(scope)} quest log is unavailable.</strong> {error}.</div>;
  if (!view) return <div className="banner info" role="status"><span className="spinner" aria-hidden="true" /> Loading the {scopeLabel(scope)} quest log…</div>;
  return (
    <>
      <div className={`banner ${view.mode === "demo" ? "demo" : "live"}`}>
        <strong>{view.mode === "demo" ? "DEMO DATA" : "LIVE DATA"}</strong>
        {view.scope.kind === "global" ? " — Global character, all tracked repositories." : ` — Repository character for ${view.scope.repositoryId}.`} Level {view.level}, rank {view.rank}.
      </div>
      <QuestLogBody quests={view.quests} log={view.questLog} />
    </>
  );
}
