import { profilePreferenceUpdateRequestSchema } from "@/lib/contracts";
import { errorJson } from "@/lib/server/api-error";
import { saveToCloud } from "@/lib/server/cloud-save";
import { updateCurrentClassPreference, ProfilePreferenceError } from "@/lib/server/profile";
import { rejectIfNonJson, rejectIfUntrustedLocalRequest } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  const untrusted = rejectIfUntrustedLocalRequest(request);
  if (untrusted) return untrusted;
  const nonJson = rejectIfNonJson(request, "Profile update");
  if (nonJson) return nonJson;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("invalid_json", "Request body must be valid JSON.", 400);
  }

  const parsed = profilePreferenceUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]));
    return errorJson("invalid_request", "Invalid profile preference payload.", 400, { fields });
  }

  try {
    const updated = updateCurrentClassPreference(parsed.data.username, parsed.data.preference);
    await saveToCloud(updated.username);
    return Response.json(updated);
  } catch (error) {
    if (error instanceof ProfilePreferenceError) {
      return errorJson(error.code, error.message, error.status);
    }
    return errorJson("profile_update_failed", "Failed to update profile preference.", 500);
  }
}
