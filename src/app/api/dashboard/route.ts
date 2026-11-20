import { buildDashboardSnapshot } from "@/lib/server/dashboard";
import { errorJson } from "@/lib/server/api-error";
import { ScopeError, parseScopeFromRequest } from "@/lib/server/scope";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const scope = parseScopeFromRequest(request);
    const dashboard = await buildDashboardSnapshot(undefined, scope);
    return Response.json(dashboard);
  } catch (error) {
    if (error instanceof ScopeError) {
      return errorJson(error.code, error.message, error.status);
    }
    return errorJson("dashboard_unavailable", "Failed to build dashboard snapshot.", 500);
  }
}
