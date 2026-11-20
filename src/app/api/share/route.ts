import { buildShareSvg } from "@/lib/server/share";
import { errorJson } from "@/lib/server/api-error";
import { ScopeError, parseScopeFromRequest } from "@/lib/server/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const scope = parseScopeFromRequest(request);
    const svg = await buildShareSvg(scope);
    return new Response(svg, {
      status: 200,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ScopeError) {
      return errorJson(error.code, error.message, error.status);
    }
    return errorJson("share_unavailable", "Failed to generate share card.", 500);
  }
}
