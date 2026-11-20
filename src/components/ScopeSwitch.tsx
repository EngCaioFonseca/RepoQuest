"use client";
import { GLOBAL, scopeLabel, type ScopeSel } from "@/lib/client/scope";

export function ScopeSwitch({ scope, onChange, repositories, busy }: { scope: ScopeSel; onChange: (s: ScopeSel) => void; repositories: string[]; busy: boolean }) {
  const known = scope.kind === "repository" ? repositories.find((r) => r.toLowerCase() === scope.repositoryId.toLowerCase()) : undefined;
  const options = scope.kind === "repository" && !known ? [scope.repositoryId, ...repositories] : repositories;
  const selected = scope.kind === "repository" ? known ?? scope.repositoryId : "";
  const first = options[0];
  return (
    <section className="scope" aria-label="Character view">
      <fieldset className="scope-seg" disabled={false}>
        <legend>Character view</legend>
        <label className={scope.kind === "global" ? "on" : ""}>
          <input type="radio" name="scope" checked={scope.kind === "global"} onChange={() => onChange(GLOBAL)} /> Global
        </label>
        <label className={scope.kind === "repository" ? "on" : ""}>
          <input type="radio" name="scope" checked={scope.kind === "repository"} disabled={!first} onChange={() => first && onChange({ kind: "repository", repositoryId: first })} /> Repository
        </label>
      </fieldset>
      <div className="scope-pick">
        <label htmlFor="scope-repo">Repository</label>
        <select id="scope-repo" value={selected} onChange={(e) => e.target.value && onChange({ kind: "repository", repositoryId: e.target.value })}>
          {scope.kind === "global" && <option value="">Choose a repository…</option>}
          {options.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <p className="small" aria-live="polite">
        {busy ? `Loading ${scopeLabel(scope)} character…` : scope.kind === "global"
          ? `Global combines your tracked repositories${repositories.length ? `: ${repositories.join(", ")}` : ""}. It is not all of GitHub.`
          : `Derived only from your contributions in ${scope.repositoryId}. Levels are not copied from or added to Global.`}
        {" "}Switching only changes the view: it does not import anything or change tracked repositories.
      </p>
    </section>
  );
}
