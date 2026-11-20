import "server-only";
import type { ApiError } from "@/lib/contracts";
import type { ZodType } from "zod";

export function errorJson(
  code: string,
  message: string,
  status: number,
  extra: Partial<ApiError["error"]> = {},
): Response {
  const payload: ApiError = {
    error: {
      code,
      message,
      ...extra,
    },
  };
  return Response.json(payload, { status });
}

/** A known failure with a safe message and HTTP status; routes map it with `errorJson(e.code, e.message, e.status)`. */
export class KnownApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Parses a JSON request body against a Zod schema, or returns the 400 response to send. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  invalidMessage: string,
): Promise<{ data: T } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: errorJson("invalid_json", "Request body must be valid JSON.", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]));
    return { response: errorJson("invalid_request", invalidMessage, 400, { fields }) };
  }
  return { data: parsed.data };
}
