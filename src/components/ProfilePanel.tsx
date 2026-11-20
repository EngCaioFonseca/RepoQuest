"use client";
import { useEffect, useState } from "react";
import { profilePreferencePatchSchema, type AiToolUsage, type MageQuizAnswers } from "@/lib/contracts";
import { deriveDisplayTitle, deriveMagePath, getClassGuide, isMageActive } from "@/lib/domain/classes";
import type { DashboardView } from "@/lib/client/types";
import { Panel } from "./Primitives";

export interface PrefDraft { isAiEngineer: boolean; aiToolUsage: AiToolUsage; mageQuiz: MageQuizAnswers | null }
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; warning?: string | null } | { kind: "error"; message: string; fields?: Record<string, string> };
const guide = getClassGuide();
const questionIds = ["workflow", "engineering", "verification"] as const;

export function ProfilePanel({ view, onSave }: { view: DashboardView; onSave: (draft: PrefDraft) => Promise<string | null> }) {
  const saved: PrefDraft = { isAiEngineer: view.preference.isAiEngineer, aiToolUsage: view.preference.aiToolUsage, mageQuiz: view.preference.mageQuiz };
  const [identity, setIdentity] = useState({ isAiEngineer: saved.isAiEngineer, aiToolUsage: saved.aiToolUsage });
  const [quizStarted, setQuizStarted] = useState(Boolean(saved.mageQuiz));
  const [answers, setAnswers] = useState<Partial<MageQuizAnswers>>(saved.mageQuiz ?? {});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    setIdentity({ isAiEngineer: view.preference.isAiEngineer, aiToolUsage: view.preference.aiToolUsage });
    setQuizStarted(Boolean(view.preference.mageQuiz));
    setAnswers(view.preference.mageQuiz ?? {});
  }, [view.preference.isAiEngineer, view.preference.aiToolUsage, view.preference.mageQuiz, view.profile.username]);

  const parsed = profilePreferencePatchSchema.safeParse({ ...identity, mageQuiz: quizStarted ? answers : null });
  const quiz = parsed.success ? parsed.data.mageQuiz ?? null : null;
  const draft: PrefDraft = { ...identity, mageQuiz: quiz };
  const editable = view.preference.editable && view.mode === "live";
  const busy = status.kind === "saving";
  const dirty = identity.isAiEngineer !== saved.isAiEngineer || identity.aiToolUsage !== saved.aiToolUsage
    || quizStarted !== Boolean(saved.mageQuiz)
    || questionIds.some((key) => answers[key] !== saved.mageQuiz?.[key]);
  const active = isMageActive(draft);
  const path = active ? deriveMagePath(quiz) : null;
  const preview = deriveDisplayTitle(view.earnedTitle, draft);
  const completed = questionIds.filter((key) => answers[key] !== undefined).length;
  const usageError = status.kind === "error" ? status.fields?.["preference.aiToolUsage"] : undefined;

  function reset() {
    setIdentity({ isAiEngineer: saved.isAiEngineer, aiToolUsage: saved.aiToolUsage });
    setQuizStarted(Boolean(saved.mageQuiz));
    setAnswers(saved.mageQuiz ?? {});
    setStatus({ kind: "idle" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editable || !dirty || busy || !parsed.success) return;
    setStatus({ kind: "saving" });
    try { const warning = await onSave(draft); setStatus({ kind: "saved", warning }); }
    catch (error) { setStatus({ kind: "error", message: error instanceof Error ? error.message : "Save failed", fields: (error as { fields?: Record<string, string> }).fields }); }
  }

  return (
    <Panel id="profile" title="Your Mage path" hint="An optional, self-reported portrait of how you work with AI." defaultOpen={false}
      summary={view.preference.magePath ? `Current path: ${view.preference.magePath.name}` : view.preference.mageActive ? "Mage designation on" : "Not set"}>
      <form className="pref-form" onSubmit={submit} noValidate>
        <label className="check">
          <input type="checkbox" checked={identity.isAiEngineer} disabled={!editable || busy} onChange={(event) => { setIdentity({ ...identity, isAiEngineer: event.target.checked }); setStatus({ kind: "idle" }); }} />
          I am an AI engineer
        </label>
        <div className="field">
          <label htmlFor="ai-usage">{guide.mageQuiz.questions.usage.label}</label>
          <select id="ai-usage" value={identity.aiToolUsage} disabled={!editable || busy} aria-invalid={Boolean(usageError)} aria-describedby={usageError ? "ai-usage-error" : "ai-usage-hint"}
            onChange={(event) => { setIdentity({ ...identity, aiToolUsage: event.target.value as AiToolUsage }); setStatus({ kind: "idle" }); }}>
            {guide.mageQuiz.questions.usage.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p id="ai-usage-hint" className="hint">{guide.mageQuiz.questions.usage.options.find((option) => option.value === identity.aiToolUsage)?.description} Frequency alone never grants an advanced path.</p>
          {usageError && <p className="err" id="ai-usage-error">{usageError}</p>}
        </div>

        <div className="mage-quiz">
          <div className="quest-top">
            <div><h3>Mage Path quiz</h3><p className="small">Three questions about your workflow, engineering practice, and verification. Choose what you actually do today.</p></div>
            <span className="chip">Self-reported</span>
          </div>
          {!quizStarted ? (
            <div className="quiz-invitation">
              <p className="small">Keep the general Mage designation, or discover a path from Prompt Adept to Intelligence Monarch. No XP is awarded.</p>
              <button className="btn" type="button" disabled={!editable || busy} onClick={() => { setQuizStarted(true); setStatus({ kind: "idle" }); }}>Discover my Mage path</button>
            </div>
          ) : (
            <>
              <p className="hint" role="status">{completed} of {questionIds.length} practice questions answered. Answers are not saved until you choose Save profile.</p>
              {questionIds.map((key) => {
                const question = guide.mageQuiz.questions[key];
                const error = status.kind === "error" ? status.fields?.[`preference.mageQuiz.${key}`] : undefined;
                return (
                  <fieldset className="quiz-question" key={key} disabled={!editable || busy} aria-describedby={error ? `${key}-error` : undefined}>
                    <legend>{question.label}</legend>
                    <div className="quiz-options">
                      {question.options.map((option) => (
                        <label className={`quiz-option${answers[key] === option.value ? " selected" : ""}`} key={option.value}>
                          <input type="radio" name={`mage-${key}`} value={option.value} checked={answers[key] === option.value} aria-invalid={Boolean(error)}
                            onChange={() => { setAnswers({ ...answers, [key]: option.value }); setStatus({ kind: "idle" }); }} />
                          <span><strong>{option.label}</strong><span className="small">{option.description}</span></span>
                        </label>
                      ))}
                    </div>
                    {error && <p className="err" id={`${key}-error`}>{error}</p>}
                  </fieldset>
                );
              })}
              <button className="btn ghost" type="button" disabled={!editable || busy} onClick={() => { setQuizStarted(false); setAnswers({}); setStatus({ kind: "idle" }); }}>Clear quiz answers</button>
            </>
          )}
        </div>

        <div className="mage-result" aria-live="polite" aria-atomic="true">
          <span className="mage-seal" aria-hidden="true">✦</span>
          <div>
            <p className="caption">Your self-reported designation preview</p>
            <h3>{path?.name ?? (active ? "Mage" : "No Mage designation")}</h3>
            {path && <><p>{path.summary}</p><p className="small">{path.explanation}</p></>}
            {quizStarted && !parsed.success && <p className="small">Answer all three practice questions to preview a path, or clear the quiz to keep the general designation.</p>}
            {!active && <p className="small">Select AI engineer or report non-zero AI-tool usage to display Mage. Completed quiz answers can be saved without displaying a designation.</p>}
            <p className="title-preview">Title preview: <strong>{preview}</strong></p>
          </div>
        </div>
        <p className="small">Your answers describe your practice; they are not a verified skill assessment. Mage is never inferred from your contributions and does not change XP, rank, level, or your contribution class. These preferences apply across all your repository views.</p>
        {!editable && <p className="notice small" role="note">{view.mode === "demo" ? "Demo data has no real profile, so these settings are read-only." : "No active live profile is available to edit."}</p>}
        <div className="sync-actions">
          <button type="submit" className="btn primary" disabled={!editable || !dirty || busy || !parsed.success} aria-busy={busy}>{busy ? "Saving…" : "Save profile"}</button>
          <button type="button" className="btn ghost" disabled={!editable || !dirty || busy} onClick={reset}>Reset</button>
          <p className="hint" role="status">{status.kind === "saved" ? (status.warning ?? "Saved.") : ""}</p>
        </div>
        {status.kind === "error" && <p className="err" role="alert">Save was not confirmed: {status.message}. Refresh the dashboard to check the saved settings before trying again.</p>}
      </form>
    </Panel>
  );
}
