import "server-only";
import { GITHUB_API_BASE, GITHUB_USER_AGENT, githubApiHeaders } from "./github-api";
import { CloudSaveError, mergeSaves, playerSaveSchema, type CloudBackend, type PlayerSave } from "./cloud-save";

/**
 * GitHub Gist backend, selected with CLOUD_SAVE=gist. Each player is one file,
 * `repoquest-save-<username>.json`, in a single secret Gist owned by the
 * GITHUB_TOKEN user, so a new install finds it with no extra configuration.
 * Saves read, merge and write the file; every save is also a Gist revision.
 *
 * A secret Gist is unlisted, not private: anyone with its link can read it.
 * Saves only hold public-repository evidence and the self-reported profile quiz.
 */

const RAW_HOST = "gist.githubusercontent.com";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_LIST_PAGES = 10;
const FILE_PREFIX = "repoquest-save-";
const FILE_SUFFIX = ".json";
const DESCRIPTION = "RepoQuest cloud save. Managed by RepoQuest; edit with care.";

type GistFile = { filename?: string; content?: string; truncated?: boolean; raw_url?: string };
type Gist = { id: string; updated_at?: string; files?: Record<string, GistFile | null> };

const PERMISSION_MESSAGE = "Cloud save needs a GITHUB_TOKEN with Gists read and write permission.";

function fileName(username: string): string {
  return `${FILE_PREFIX}${username}${FILE_SUFFIX}`;
}

function isSaveFile(name: string): boolean {
  return name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX);
}

class GistNotFoundError extends Error {}

async function gistRequest<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) throw new CloudSaveError("GITHUB_TOKEN is not configured.", "Gist cloud save needs GITHUB_TOKEN to be configured.");
  let response: Response;
  try {
    response = await fetch(`${GITHUB_API_BASE}${path}`, {
      method,
      headers: {
        ...githubApiHeaders(token),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CloudSaveError(`Gist ${method} ${path}: network error`, "GitHub could not be reached for the cloud save.");
  }
  if (response.ok) return (await response.json()) as T;

  const detail = `Gist ${method} ${path}: HTTP ${response.status}`;
  const rateLimited = response.status === 429
    || (response.status === 403 && (response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")));
  if (rateLimited) throw new CloudSaveError(detail, "GitHub rate limit reached; the cloud save is retried on the next sync.");
  if (response.status === 401) throw new CloudSaveError(detail, "GitHub rejected the token used for the cloud save.");
  if (response.status === 404 && method !== "POST" && path.startsWith("/gists/")) throw new GistNotFoundError(detail);
  // Tokens without Gist permission get 403 (fine-grained) or 404 (classic without the gist scope).
  if (response.status === 403 || response.status === 404) throw new CloudSaveError(detail, PERMISSION_MESSAGE);
  throw new CloudSaveError(detail, "GitHub returned an error during the cloud save.");
}

async function fileContent(file: GistFile): Promise<string | null> {
  if (!file.truncated && typeof file.content === "string") return file.content;
  // The Gist API truncates contents over 1 MB; the raw URL serves the full file.
  if (!file.raw_url) return null;
  const raw = new URL(file.raw_url);
  if (raw.protocol !== "https:" || raw.hostname !== RAW_HOST) return null;
  let response: Response;
  try {
    response = await fetch(raw, { headers: { "user-agent": GITHUB_USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new CloudSaveError("Gist raw file: network error", "GitHub could not be reached for the cloud save.");
  }
  if (!response.ok) throw new CloudSaveError(`Gist raw file: HTTP ${response.status}`, "GitHub returned an error during the cloud save.");
  return response.text();
}

function parseSave(content: string | null, name: string): PlayerSave | null {
  if (content === null) return null;
  try {
    const parsed = playerSaveSchema.safeParse(JSON.parse(content));
    if (parsed.success) return parsed.data;
  } catch {
    // Fall through to the warning below.
  }
  console.warn(`RepoQuest cloud save: ignoring unreadable Gist file ${name}.`);
  return null;
}

export function createGistBackend(): CloudBackend {
  let cachedGistId: string | null = null;

  async function findGistId(): Promise<string | null> {
    if (cachedGistId) return cachedGistId;
    let best: Gist | null = null;
    for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
      const gists = await gistRequest<Gist[]>("GET", `/gists?per_page=100&page=${page}`);
      for (const gist of gists) {
        if (!Object.keys(gist.files ?? {}).some(isSaveFile)) continue;
        if (!best || (gist.updated_at ?? "") > (best.updated_at ?? "")) best = gist;
      }
      if (gists.length < 100) break;
    }
    cachedGistId = best?.id ?? null;
    return cachedGistId;
  }

  async function readGist(): Promise<Gist | null> {
    const id = await findGistId();
    if (!id) return null;
    try {
      return await gistRequest<Gist>("GET", `/gists/${encodeURIComponent(id)}`);
    } catch (error) {
      if (!(error instanceof GistNotFoundError)) throw error;
      // The cached Gist was deleted; look again.
      cachedGistId = null;
      const retryId = await findGistId();
      return retryId ? gistRequest<Gist>("GET", `/gists/${encodeURIComponent(retryId)}`) : null;
    }
  }

  async function readSave(gist: Gist, name: string): Promise<PlayerSave | null> {
    const file = gist.files?.[name];
    return file ? parseSave(await fileContent(file), name) : null;
  }

  return {
    kind: "gist",

    async loadLatest(): Promise<PlayerSave | null> {
      const gist = await readGist();
      if (!gist) return null;
      let latest: PlayerSave | null = null;
      for (const name of Object.keys(gist.files ?? {}).filter(isSaveFile)) {
        const save = await readSave(gist, name);
        if (save && (!latest || save.savedAt > latest.savedAt)) latest = save;
      }
      return latest;
    },

    async store(save: PlayerSave): Promise<void> {
      const name = fileName(save.profile.username);
      const gist = await readGist();
      if (!gist) {
        const created = await gistRequest<Gist>("POST", "/gists", {
          description: DESCRIPTION,
          public: false,
          files: { [name]: { content: JSON.stringify(save) } },
        });
        cachedGistId = created.id;
        return;
      }
      // Read-merge-write: another install's evidence and newer coverage are kept.
      const merged = mergeSaves(await readSave(gist, name), save);
      await gistRequest<Gist>("PATCH", `/gists/${encodeURIComponent(gist.id)}`, {
        files: { [name]: { content: JSON.stringify(merged) } },
      });
    },

    async close(): Promise<void> {
      cachedGistId = null;
    },
  };
}
