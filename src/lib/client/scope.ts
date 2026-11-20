import type { DashboardScope } from "@/lib/contracts";
import type { DashboardView } from "./types";

/** Which character the dashboard shows. Read-only: independent of the sync form and tracked set. */
export type ScopeSel = DashboardScope;
export const GLOBAL: ScopeSel = { kind: "global" };

export const scopeKey = (s: ScopeSel): string => (s.kind === "global" ? "global" : `repo:${s.repositoryId.toLowerCase()}`);

/** Contract query: omit for global, ?repository=owner%2Fname for a repository view. */
export function scopeQuery(s: ScopeSel): string {
  return s.kind === "global" ? "" : `?${new URLSearchParams({ repository: s.repositoryId })}`;
}

export const scopeLabel = (s: ScopeSel): string => (s.kind === "global" ? "Global" : s.repositoryId);

/** A snapshot may be shown only if the server says it was derived for the requested scope. */
export function scopeMatches(sel: ScopeSel, view: Pick<DashboardView, "scope">): boolean {
  const got = view.scope;
  if (sel.kind === "global") return got.kind === "global";
  return got.kind === "repository" && got.repositoryId.toLowerCase() === sel.repositoryId.toLowerCase();
}

export function parseStoredScope(raw: string | null): ScopeSel {
  try {
    const p = raw ? (JSON.parse(raw) as { kind?: unknown; repositoryId?: unknown }) : null;
    if (p?.kind === "repository" && typeof p.repositoryId === "string" && /^[\w.-]+\/[\w.-]+$/.test(p.repositoryId)) return { kind: "repository", repositoryId: p.repositoryId };
  } catch { /* fall through */ }
  return GLOBAL;
}
