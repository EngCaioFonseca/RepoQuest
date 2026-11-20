import "server-only";
import type { DashboardScope } from "@/lib/contracts";
import { renderShareSvg } from "@/lib/domain/share-svg";
import { buildDashboardSnapshot } from "./dashboard";

export async function buildShareSvg(scope: DashboardScope): Promise<string> {
  const snapshot = await buildDashboardSnapshot(undefined, scope);
  return renderShareSvg(snapshot);
}
