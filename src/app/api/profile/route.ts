import { profilePreferenceUpdateRequestSchema } from "@/lib/contracts";
import { errorJson, parseJsonBody } from "@/lib/server/api-error";
import { saveToCloud } from "@/lib/server/cloud-save";
import { updateCurrentClassPreference, ProfilePreferenceError } from "@/lib/server/profile";
import { rejectIfNonJson, rejectIfUntrustedLocalRequest } from "@/lib/server/request-guard";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  const untrusted = rejectIfUntrustedLocalRequest(request);
  if (untrusted) return untrusted;
  const nonJson = rejectIfNonJson(request, "Profile update");
  if (nonJson) return nonJson;

  const input = await parseJsonBody(request, profilePreferenceUpdateRequestSchema, "Invalid profile preference payload.");
  if ("response" in input) return input.response;

  try {
    const updated = updateCurrentClassPreference(input.data.username, input.data.preference);
    await saveToCloud(updated.username);
    return Response.json(updated);
  } catch (error) {
    if (error instanceof ProfilePreferenceError) {
      return errorJson(error.code, error.message, error.status);
    }
    return errorJson("profile_update_failed", "Failed to update profile preference.", 500);
  }
}
