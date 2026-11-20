import type { ApiError as ApiErrorBody, DashboardSnapshot, SyncRequest, SyncResponse } from "@/lib/contracts";
import { normalizeDashboard, normalizeSync } from "./normalize";
import { scopeMatches, scopeQuery, type ScopeSel } from "./scope";
import { ApiError, type DashboardView, type SyncSummary } from "./types";

async function readError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body.error && typeof body.error.message === "string") return new ApiError(body.error.message, res.status, body.error.code, body.error.retryAt, body.error.fields);
  } catch { /* non-JSON body */ }
  return new ApiError(`Request failed (HTTP ${res.status})`, res.status);
}

async function call(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("Cannot reach the RepoQuest server. Is it running?", 0, "network");
  }
}

export async function fetchDashboard(scope: ScopeSel = { kind: "global" }): Promise<DashboardView> {
  const res = await call(`/api/dashboard${scopeQuery(scope)}`);
  if (!res.ok) throw await readError(res);
  const view = normalizeDashboard((await res.json()) as DashboardSnapshot);
  // Never present a snapshot as another scope's character.
  if (!scopeMatches(scope, view)) throw new ApiError("The server did not return a character for this view, so nothing is shown.", 200, "scope_mismatch");
  return view;
}

/** POST /api/sync. Throws on failure; callers keep the previous snapshot and never fall back to demo data. */
export async function runSync(req: SyncRequest): Promise<{ dashboard: DashboardView; summary: SyncSummary }> {
  const res = await call("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(req) });
  if (!res.ok) throw await readError(res);
  return normalizeSync((await res.json()) as SyncResponse);
}

export const shareUrl = (scope: ScopeSel): string => `/api/share${scopeQuery(scope)}`;

export async function downloadShareCard(scope: ScopeSel): Promise<void> {
  const res = await call(shareUrl(scope));
  if (!res.ok) throw await readError(res);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = scope.kind === "global" ? "repoquest-global-card.svg" : `repoquest-${scope.repositoryId.replace("/", "-")}-card.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
