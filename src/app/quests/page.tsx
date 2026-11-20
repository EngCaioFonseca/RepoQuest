import type { Metadata } from "next";
import Link from "next/link";
import { QuestLogPage } from "@/components/QuestLogPage";
import { dashboardScopeQuerySchema } from "@/lib/contracts";
import { scopeQuery } from "@/lib/client/scope";

export const metadata: Metadata = {
  title: "Quest log — RepoQuest",
  description: "Completed quests by level, your relic arsenal, renown and the next quest in every questline.",
};

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function QuestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const parsed = dashboardScopeQuerySchema.safeParse(first(sp.repository) ? { repository: first(sp.repository) } : {});
  const scope = parsed.success ? parsed.data : ({ kind: "global" } as const);
  const q = scopeQuery(scope);
  return (
    <div className="shell about">
      <header className="topbar">
        <Link className="brand" href={`/${q}`}>Repo<span>Quest</span></Link>
        <nav aria-label="Quest log sections" className="open">
          <a href="#arsenal">Arsenal</a><a href="#active">Active</a><a href="#completed">Completed</a>
          <Link href={`/about${q}#quests`}>How quests work</Link>
        </nav>
        <Link className="btn" href={`/${q}`}>Back to dashboard</Link>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="about-hero">
          <h1>Quest log</h1>
          <p className="lede">Every quest you have completed, grouped by the level you reached it at, and the relics they awarded. Opening this page never syncs anything.</p>
        </section>
        {!parsed.success && <div className="banner warn"><strong>Unrecognised repository in the link.</strong> Showing the Global view instead.</div>}
        <QuestLogPage scope={scope} />
      </main>
    </div>
  );
}
