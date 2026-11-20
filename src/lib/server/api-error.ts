import type { ApiError } from "@/lib/contracts";

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
