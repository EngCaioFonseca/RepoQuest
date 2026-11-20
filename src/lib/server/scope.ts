import "server-only";
import { dashboardScopeQuerySchema, type DashboardScope } from "@/lib/contracts";

export class ScopeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function parseScopeFromRequest(request: Request): DashboardScope {
  const url = new URL(request.url);
  const repositories = url.searchParams.getAll("repository");
  if (repositories.length > 1) {
    throw new ScopeError("invalid_scope_query", "Duplicate repository query parameters are not allowed.", 400);
  }
  for (const key of url.searchParams.keys()) {
    if (key !== "repository") {
      throw new ScopeError("invalid_scope_query", `Unsupported query parameter: ${key}.`, 400);
    }
  }
  const parsed = dashboardScopeQuerySchema.safeParse(repositories.length === 0 ? {} : { repository: repositories[0] });
  if (!parsed.success) {
    throw new ScopeError("invalid_scope_query", "Invalid dashboard scope query.", 400);
  }
  return parsed.data;
}

export function resolveTrackedScope(scope: DashboardScope, trackedRepositories: string[]): DashboardScope {
  if (scope.kind === "global") return scope;
  const index = new Map(trackedRepositories.map((repositoryId) => [repositoryId.toLowerCase(), repositoryId]));
  const canonical = index.get(scope.repositoryId.toLowerCase());
  if (!canonical) {
    throw new ScopeError("repository_not_tracked", `Repository ${scope.repositoryId} is not tracked.`, 404);
  }
  return { kind: "repository", repositoryId: canonical };
}
