import { syncRequestSchema } from "@/lib/contracts";

// Validation is delegated to the shared request schema so client and server cannot drift.
/** Mirrors the contract cap (syncRequestSchema allows 1-10 repositories). */
export const MAX_REPOSITORIES = 10;
const OK_USER = "octocat";
const OK_REPO = "octocat/hello";

export const isValidSlug = (s: string): boolean => syncRequestSchema.safeParse({ username: OK_USER, repositories: [s] }).success;
export const isValidUsername = (s: string): boolean => syncRequestSchema.safeParse({ username: s, repositories: [OK_REPO] }).success;

export function percent(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toISOString().slice(0, 10);
}

export function formatXp(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}
