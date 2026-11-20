import type { RepoView } from "./types";

export type CoverageTone = "ok" | "work" | "warn" | "bad" | "idle";
export interface CoverageLabel { label: string; tone: CoverageTone; detail: string }

/** Plain-language coverage state. Incomplete or failed history is never described as zero activity. */
export function describeCoverage(c: RepoView["coverage"]): CoverageLabel {
  switch (c.backfillStatus) {
    case "complete": return { label: "Complete", tone: "ok", detail: "All supported history was scanned." };
    case "empty": return { label: "No activity found", tone: "idle", detail: "Supported history was scanned and contained no matching contributions." };
    case "in_progress": return { label: "Importing history", tone: "work", detail: "Existing contribution history is still being imported; progress is provisional." };
    case "partial": return { label: "Partial — provisional", tone: "warn", detail: `Some history could not be read${c.canResume ? "; a later sync will resume" : ""}. Progress shown may be lower than your true total.` };
    case "failed": return { label: "Import failed", tone: "bad", detail: `History could not be read${c.canResume ? "; sync again to resume" : ""}. This is not evidence of zero activity.` };
    default: return { label: "Not imported yet", tone: "idle", detail: "Existing history has not been imported. Sync to recover prior work." };
  }
}

const REASONS: Record<NonNullable<RepoView["coverage"]["failureReason"]>, string> = {
  rate_limited: "GitHub rate limit reached", permission_denied: "access to some history was denied", api_limit: "GitHub API result cap reached",
  network_error: "network error", provider_error: "GitHub returned an error", interrupted: "the import was interrupted",
};
export const reasonText = (c: RepoView["coverage"]): string | null => (c.failureReason ? REASONS[c.failureReason] : null);

export const isIncomplete = (c: RepoView["coverage"]): boolean => c.backfillStatus !== "complete" && c.backfillStatus !== "empty";
