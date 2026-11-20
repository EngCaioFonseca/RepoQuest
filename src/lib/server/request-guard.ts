import "server-only";
import { errorJson } from "./api-error";

export function isAllowedHost(host: string | null): boolean {
  if (!host) return false;
  const value = host.toLowerCase();
  const allowed = new Set([
    process.env.REPOQUEST_PUBLIC_HOST?.toLowerCase() ?? "",
  ]);
  if (allowed.has(value)) return true;
  return value.startsWith("127.0.0.1:") || value.startsWith("localhost:") || value.startsWith("[::1]:");
}

export function rejectIfUntrustedLocalRequest(request: Request): Response | null {
  const host = request.headers.get("host");
  if (!isAllowedHost(host)) {
    return errorJson("forbidden_host", "Requests are only accepted on trusted local hosts.", 403);
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
      return errorJson("forbidden_origin", "Cross-origin requests are not allowed.", 403);
    }
  }
  return null;
}

export function rejectIfNonJson(request: Request, operationLabel: string): Response | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return errorJson("invalid_content_type", `${operationLabel} requires content-type: application/json.`, 415);
  }
  return null;
}
