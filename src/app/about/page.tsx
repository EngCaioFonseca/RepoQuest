import type { Metadata } from "next";
import Link from "next/link";
import { CurrentCharacter } from "@/components/CurrentCharacter";
import { dashboardScopeQuerySchema } from "@/lib/contracts";
import { getProgressionGuide } from "@/lib/domain/progression";
import { scopeQuery } from "@/lib/client/scope";

export const metadata: Metadata = {
  title: "Progression guide — RepoQuest",
  description: "How levels, ranks and titles are earned in RepoQuest, and what they do and do not mean.",
};

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function AboutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const parsed = dashboardScopeQuerySchema.safeParse(first(sp.repository) ? { repository: first(sp.repository) } : {});
  const scope = parsed.success ? parsed.data : ({ kind: "global" } as const);
  const q = scopeQuery(scope);
  const guide = getProgressionGuide();
  const r = guide.xp.evidenceRules;
  const xpRows: [string, number][] = [
    ["Merged engineering pull request", r.mergedEngineeringPr],
    ["Merged documentation pull request", r.mergedDocumentationPr],
    ["Submitted review", r.submittedReview],
    ["Documentation issue", r.documentationIssue],
  ];

  return (
    <div className="shell about">
      <header className="topbar">
        <Link className="brand" href={`/${q}`}>Repo<span>Quest</span></Link>
        <nav aria-label="Guide sections" className="open">
          <a href="#you">You</a><a href="#concepts">Concepts</a><a href="#ranks">Ranks</a><a href="#titles">Titles</a><a href="#xp">XP</a><a href="#limits">Limits</a>
        </nav>
        <Link className="btn" href={`/${q}`}>Back to dashboard</Link>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="about-hero">
          <h1>How progression works</h1>
          <p className="lede">Your level, rank and title are a game layer over public contribution evidence. This page shows the actual rules, version {guide.scoringVersion}, so you can see why you hold what you hold and what moves you forward.</p>
        </section>
        {!parsed.success && <div className="banner warn"><strong>Unrecognised repository in the link.</strong> Showing the Global view instead.</div>}

        <section className="panel" id="you" aria-labelledby="you-h">
          <h2 id="you-h">Where you stand</h2>
          <CurrentCharacter scope={scope} />
          <p className="small">Read from the dashboard as it is now. Opening this page never syncs anything.</p>
        </section>

        <section className="panel" id="concepts" aria-labelledby="c-h">
          <h2 id="c-h">Levels, ranks and titles are different things</h2>
          <dl className="defs">
            <div><dt>Level</dt><dd>Derived from the XP in your current evidence for the view you are looking at. It usually rises as you earn XP, but it can fall if the tracked repositories, the view or the scoring version change, for example when an item is reclassified. The same ruleset applies in every view.</dd></div>
            <div><dt>Rank (E to S)</dt><dd>Counts milestones reached across tracks (merged pull requests, documentation and review contributions, achievements), not raw XP. XP alone does not raise it; the milestone counts in the ladder below do.</dd></div>
            <div><dt>Title</dt><dd>Names a specific accomplishment. You can unlock several; one is displayed. {guide.displayedTitleSelection}</dd></div>
            <div><dt>Global and Repository views</dt><dd>Global covers the repositories you track, not all of GitHub. A Repository view applies the same rules to your evidence in that one repository only. Levels are never copied between views or added together. {guide.scopeRules.note}</dd></div>
          </dl>
        </section>

        <section className="panel" id="ranks" aria-labelledby="r-h">
          <h2 id="r-h">The rank ladder</h2>
          <p className="hint">Each step lists what is needed to leave that rank.</p>
          <ol className="ladder">
            {guide.ranks.map((x) => (
              <li key={x.rank} className="rung">
                <div className={`sigil sm rank-${x.rank}`} role="img" aria-label={`Rank ${x.rank}`}><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 91,27 91,73 50,96 9,73 9,27" /></svg><span>{x.rank}</span></div>
                <div><h3>Rank {x.rank}</h3><p>{x.meaning}</p><p className="advance"><strong>To advance:</strong> {x.advancement}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel" id="titles" aria-labelledby="t-h">
          <h2 id="t-h">Titles</h2>
          <p className="hint">{guide.displayedTitleSelection}</p>
          <ul className="titles-list">
            {guide.titles.map((t) => (
              <li key={t.title} className="title-card">
                <div className="quest-top"><h3>{t.title}</h3>{t.globalOnly && <span className="chip">Global view only</span>}</div>
                <p>{t.meaning}</p>
                <p className="small"><strong>Unlocked by:</strong> {t.unlock}</p>
              </li>
            ))}
          </ul>
          {guide.scopeRules.globalOnlyAchievementIds.length > 0 && <p className="small">Repository breadth badges ({guide.scopeRules.globalOnlyAchievementIds.join(", ")}) exist only in the Global view.</p>}
        </section>

        <section className="panel" id="xp" aria-labelledby="x-h">
          <h2 id="x-h">XP and the level curve</h2>
          <table className="xp-table">
            <caption className="sr">XP awarded per kind of evidence</caption>
            <thead><tr><th scope="col">Evidence</th><th scope="col">XP</th></tr></thead>
            <tbody>{xpRows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody>
          </table>
          <p>{guide.xp.levelFormula} The base step is {guide.xp.levelBaseStep} XP, so each level asks for more than the last.</p>
          <p className="small">Lines changed, comment volume and raw commit counts are not rewarded.</p>
        </section>

        <section className="panel" id="history" aria-labelledby="h-h">
          <h2 id="h-h">Past work counts</h2>
          <p>The first sync reads your existing contribution history in each selected repository, not just recent activity. Each item keeps its original date. Syncing again resumes unfinished imports, and an item already counted is never scored twice. Until a repository shows Complete coverage, its progress is provisional and may rise.</p>
        </section>

        <section className="panel" id="limits" aria-labelledby="l-h">
          <h2 id="l-h">What this does not measure</h2>
          <ul className="bullets">
            <li>Only merged pull requests, submitted reviews and documentation issues from public GitHub are counted. Other kinds of work, private repositories and work done elsewhere do not appear.</li>
            <li>Documentation is recognised from pull request and issue titles and descriptions, so some real documentation work may be classed as engineering and the reverse.</li>
            <li>A rank is a local game score. It is not a verified measure of developer skill, and not a global or competitive ranking.</li>
          </ul>
        </section>
      </main>
      <footer className="foot small"><Link href={`/${q}`}>Back to dashboard</Link></footer>
    </div>
  );
}
