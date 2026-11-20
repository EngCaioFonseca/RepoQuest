import { syncRequestSchema, type SyncRequest } from "@/lib/contracts";
import { errorJson } from "@/lib/server/api-error";
import { GitHubSyncError } from "@/lib/server/github";
import { SyncInProgressError, syncFromGitHub } from "@/lib/server/sync";

export const dynamic = "force-dynamic";

function isAllowedHost(host: string | null): boolean {
  if (!host) return false;
  const value = host.toLowerCase();
  const allowed = new Set([
    process.env.REPOQUEST_PUBLIC_HOST?.toLowerCase() ?? "",
  ]);
  if (allowed.has(value)) return true;
  return value.startsWith("127.0.0.1:") || value.startsWith("localhost:") || value.startsWith("[::1]:");
}

function mapFailureStatus(failureReason: GitHubSyncError["failureReason"]): number {
  switch (failureReason) {
    case "rate_limited":
      return 429;
    case "permission_denied":
      return 403;
    case "network_error":
    case "provider_error":
      return 503;
    default:
      return 500;
  }
}

export async function POST(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  if (!isAllowedHost(host)) {
    return errorJson("forbidden_host", "Requests are only accepted on trusted local hosts.", 403);
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return errorJson("invalid_content_type", "Sync requires content-type: application/json.", 415);
  }
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin === "null") {
      return errorJson("forbidden_origin", "Sandboxed origins are not allowed.", 403);
    }
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return errorJson("forbidden_origin", "Malformed origin header.", 403);
    }
    if (originHost !== host) {
      return errorJson("forbidden_origin", "Cross-origin sync requests are not allowed.", 403);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("invalid_json", "Request body must be valid JSON.", 400);
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]));
    return errorJson("invalid_request", "Invalid sync request payload.", 400, { fields });
  }

  try {
    const response = await syncFromGitHub(parsed.data as SyncRequest);
    return Response.json(response);
  } catch (error) {
    if (error instanceof SyncInProgressError) {
      return errorJson("sync_in_progress", error.message, 409);
    }
    if (error instanceof GitHubSyncError) {
      return errorJson("sync_failed", error.message, mapFailureStatus(error.failureReason), { retryAt: error.retryAt });
    }
    return errorJson("sync_failed", "Unexpected sync failure.", 500);
  }
}
