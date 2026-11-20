import "server-only";
import type { ContributorClassPreference, ProfilePreferencePatch } from "@/lib/contracts";
import { withMagePreference } from "@/lib/domain/classes";
import { KnownApiError } from "./api-error";
import { readClassPreference, readProfile, readSyncState, updateClassPreference } from "./repository";

export class ProfilePreferenceError extends KnownApiError {}

export function updateCurrentClassPreference(expectedUsername: string, patch: ProfilePreferencePatch): { username: string; preference: ContributorClassPreference } {
  const sync = readSyncState();
  const activeUsername = sync.username?.toLowerCase() ?? null;
  if (!activeUsername) {
    throw new ProfilePreferenceError("profile_unavailable", "No synced contributor is active for profile updates.", 409);
  }
  if (expectedUsername.toLowerCase() !== activeUsername) {
    throw new ProfilePreferenceError("stale_profile_identity", "Profile preference update no longer matches the active contributor.", 409);
  }
  if (!readProfile(activeUsername)) {
    throw new ProfilePreferenceError("profile_unavailable", "Active contributor profile is not available yet.", 409);
  }
  const stored = updateClassPreference(activeUsername, patch);
  return { username: activeUsername, preference: withMagePreference(stored, true) };
}
