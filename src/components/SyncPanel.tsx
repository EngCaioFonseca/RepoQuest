"use client";
import { useState } from "react";
import { MAX_REPOSITORIES } from "@/lib/client/format";
import { isValidSlug, isValidUsername } from "@/lib/client/format";
import type { StorageStatus } from "@/lib/contracts";
import { Panel } from "./Primitives";

function storageNote(storage: StorageStatus | null | undefined): string | null {
  if (!storage) return null;
  const local = storage.local === "memory"
    ? "Progress is kept in memory only and is discarded when the server stops."
    : "Progress is saved in the local database on this machine.";
  if (storage.cloudSave === "off") return local;
  const where = "a secret GitHub Gist";
  if (storage.cloudSave === "error") return `${local} Cloud save to ${where} is not working: ${storage.cloudProblem ?? "the last save or restore failed."} It is retried on the next sync.`;
  return `${local} Cloud save to ${where} is on${storage.restoredFromCloud ? " (restored from your cloud save)" : ""}.`;
}

export interface SyncForm { username: string; repos: string[] }

export function SyncPanel({ form, onChange, onSync, syncing, firstSync, disabled, serverFields, storage }: {
  form: SyncForm; onChange: (f: SyncForm) => void; onSync: () => void; syncing: boolean; firstSync: boolean; disabled: boolean; serverFields?: Record<string, string>; storage?: StorageStatus | null;
}) {
  const storageText = storageNote(storage);
  const [touched, setTouched] = useState(false);
  const userOk = isValidUsername(form.username);
  const badRepos = form.repos.map((r) => r.trim() !== "" && !isValidSlug(r));
  const filled = form.repos.filter((r) => r.trim() !== "");
  const valid = userOk && filled.length > 0 && !badRepos.some(Boolean);
  const fieldErr = (key: string): string | undefined => serverFields?.[key];
  const userErr = touched && !userOk ? "Enter a valid GitHub username." : fieldErr("username");
  const setRepo = (i: number, v: string) => onChange({ ...form, repos: form.repos.map((r, j) => (j === i ? v : r)) });

  return (
    <Panel id="sync" title="Sync" defaultOpen={firstSync} hint={firstSync ? "Your existing contribution history in each repository counts. The first sync imports it, not just recent activity." : "Sync resumes any unfinished history import, then picks up new work. Already-counted evidence is not scored twice."}>
      <form className="sync-form" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (valid && !syncing && !disabled) onSync(); }}>
        <div className="field">
          <label htmlFor="username">GitHub username</label>
          <input id="username" value={form.username} autoComplete="off" spellCheck={false} aria-invalid={Boolean(userErr)} aria-describedby={userErr ? "username-err" : undefined}
            onChange={(e) => onChange({ ...form, username: e.target.value })} placeholder="octocat" />
          {userErr && <p className="err" id="username-err">{userErr}</p>}
        </div>
        <fieldset className="field">
          <legend>Repository realms</legend>
          {form.repos.map((r, i) => {
            const err = badRepos[i] ? "Use the form owner/name, not a URL." : fieldErr(`repositories.${i}`) ?? fieldErr("repositories");
            return (
              <div className="repo-row" key={i}>
                <label className="sr" htmlFor={`repo-${i}`}>Repository {i + 1} (owner/name)</label>
                <input id={`repo-${i}`} value={r} spellCheck={false} aria-invalid={Boolean(err)} aria-describedby={err ? `repo-${i}-err` : undefined} placeholder="owner/name"
                  onChange={(e) => setRepo(i, e.target.value)} />
                <button type="button" className="btn ghost" aria-label={`Remove repository ${r || i + 1}`} disabled={form.repos.length <= 1} onClick={() => onChange({ ...form, repos: form.repos.filter((_, j) => j !== i) })}>✕</button>
                {err && <p className="err" id={`repo-${i}-err`}>{err}</p>}
              </div>
            );
          })}
          <button type="button" className="btn ghost" disabled={form.repos.length >= MAX_REPOSITORIES} onClick={() => onChange({ ...form, repos: [...form.repos, ""] })}>+ Add repository</button>
          {touched && filled.length === 0 && <p className="err" role="alert">Add at least one repository.</p>}
        </fieldset>
        <div className="sync-actions">
          <button type="submit" className="btn primary" disabled={syncing || disabled} aria-busy={syncing}>{syncing ? "Syncing…" : "Sync contributions"}</button>
          <p className="hint">Nothing is fetched until you press Sync. The GitHub token, if any, is configured on the server and never shown here. {disabled ? " Live sync is currently unavailable because no token is configured." : ""} Demo data stays labelled as demo.</p>
          {storageText && <p className="hint" data-testid="storage-status">{storageText}</p>}
        </div>
      </form>
    </Panel>
  );
}
