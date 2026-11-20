import { syncRequestSchema, type SyncRequest } from "@/lib/contracts";
import { errorJson } from "@/lib/server/api-error";
import { GitHubSyncError } from "@/lib/server/github";
import { rejectIfNonJson, rejectIfUntrustedLocalRequest } from "@/lib/server/request-guard";
import { SyncInProgressError, syncFromGitHub } from "@/lib/server/sync";

export const dynamic = "force-dynamic";

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
  const untrusted = rejectIfUntrustedLocalRequest(request);
  if (untrusted) return untrusted;
  const nonJson = rejectIfNonJson(request, "Sync");
  if (nonJson) return nonJson;

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
