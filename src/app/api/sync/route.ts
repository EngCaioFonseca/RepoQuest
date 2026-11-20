import { syncRequestSchema } from "@/lib/contracts";
import { errorJson, parseJsonBody } from "@/lib/server/api-error";
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

  const input = await parseJsonBody(request, syncRequestSchema, "Invalid sync request payload.");
  if ("response" in input) return input.response;

  try {
    const response = await syncFromGitHub(input.data);
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
