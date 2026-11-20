import "server-only";
import type { ContributorClassPreference, ProfilePreferencePatch } from "@/lib/contracts";
import { defaultClassPreference, withMagePreference } from "@/lib/domain/classes";
import { readClassPreference, readProfile, readSyncState, updateClassPreference } from "./repository";

export class ProfilePreferenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function readCurrentClassPreference(): { username: string | null; preference: ContributorClassPreference } {
  const sync = readSyncState();
  const username = sync.username?.toLowerCase() ?? null;
  if (!username) {
    return { username: null, preference: defaultClassPreference(false) };
  }
  const stored = readClassPreference(username);
  return { username, preference: withMagePreference(stored, true) };
}

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
