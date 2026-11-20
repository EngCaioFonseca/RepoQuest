import type { Metadata } from "next";
import Link from "next/link";
import { CurrentCharacter } from "@/components/CurrentCharacter";
import { dashboardScopeQuerySchema } from "@/lib/contracts";
import { getProgressionGuide } from "@/lib/domain/progression";
import { getClassGuide, isMageActive, AI_TOOL_USAGE_VALUES } from "@/lib/domain/classes";
import { AI_USAGE_LABELS } from "@/lib/client/types";
import { CLASS_GLYPH } from "@/components/ClassSection";
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
  const cg = getClassGuide();
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
          <a href="#you">You</a><a href="#concepts">Concepts</a><a href="#classes">Classes</a><a href="#mastery">Monarchs</a><a href="#ranks">Ranks</a><a href="#titles">Titles</a><a href="#xp">XP</a><a href="#limits">Limits</a>
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

        <section className="panel" id="classes" aria-labelledby="cl-h">
          <h2 id="cl-h">Classes and specialties</h2>
          <p>{cg.distinctions.progressionTitleVsClass}</p>
          <p className="small">A class describes the kind of work in your contributions in the view you are looking at. It is a heuristic from titles, kinds and tracks (classifier {cg.classifierVersion}), not from reading code, and it says nothing about the tools you used or your job.</p>
          <div className="class-guide">
            {cg.classes.map((c) => (
              <article key={c.id} className={`class-card class-${c.id}`}>
                <h3><span aria-hidden="true">{CLASS_GLYPH[c.id]}</span> {c.name}</h3>
                <p>{c.summary}</p>
                <p className="small"><strong>Votes:</strong> {c.voteRule}</p>
              </article>
            ))}
          </div>
          <h3 className="sub">Specialties</h3>
          <dl className="defs">{cg.specialties.map((s) => <div key={s.id}><dt>{s.label}</dt><dd>{s.explanation}</dd></div>)}</dl>
          <h3 className="sub">How the class is chosen</h3>
          <ul className="bullets">
            <li>{cg.votePolicy.oneVotePerContribution}</li><li>{cg.votePolicy.dedupeRule}</li><li>{cg.votePolicy.tieRule}</li>
            <li>{cg.votePolicy.insufficientEvidenceRule}</li><li>{cg.votePolicy.scopeRule}</li>
          </ul>
          <h3 className="sub">States</h3>
          <dl className="defs">{cg.stateRules.map((s) => <div key={s.state}><dt>{s.state}</dt><dd>{s.meaning}</dd></div>)}</dl>
          <h3 className="sub">The Mage badge is self-reported</h3>
          <p>{cg.distinctions.mageBadgeMode}</p>
          <p className="small">You set it yourself in the AI profile panel on the dashboard. It is saved for you and appears the same in Global and every repository view. It adds to your title (for example, your earned title followed by Mage) and never changes XP, rank, level or the class chosen from your contributions. Nothing about your tools is inferred from your work.</p>
          <table className="xp-table">
            <caption className="sr">When the Mage badge is shown for each AI tool usage answer</caption>
            <thead><tr><th scope="col">AI tool usage you report</th><th scope="col">Mage badge</th></tr></thead>
            <tbody>{AI_TOOL_USAGE_VALUES.map((v) => <tr key={v}><th scope="row">{AI_USAGE_LABELS[v]}</th><td>{isMageActive({ isAiEngineer: false, aiToolUsage: v }) ? "Shown" : "Not shown"}</td></tr>)}</tbody>
          </table>
          <p className="small">Ticking "I am an AI engineer" shows the badge whatever usage you choose.</p>
          <h3 className="sub" id="mage-paths">Find your Mage path</h3>
          <p>{cg.distinctions.magePathMode} The optional quiz describes your current practice, not a verified level of knowledge. AI-tool usage intensity alone never grants an advanced path.</p>
          <ol className="mage-paths">
            {cg.mageQuiz.paths.map((path) => <li key={path.id}><h4>{path.name}</h4><p>{path.summary}</p><p className="small"><strong>Selected when:</strong> {path.requirement}</p></li>)}
          </ol>
          <p className="small">No quiz answers means the general Mage designation. You can edit or clear your answers in the dashboard. Clearing answers removes the subclass; turning off AI engineer and selecting None or Not specified hides the Mage designation entirely. Your earned title, contribution class, and XP remain unchanged.</p>
          <details className="more">
            <summary>What the quiz asks</summary>
            <dl className="defs">{Object.entries(cg.mageQuiz.questions).map(([key, question]) => (
              <div key={key}><dt>{question.label}</dt><dd><ul>{question.options.map((option) => <li key={option.value}><strong>{option.label}:</strong> {option.description}</li>)}</ul></dd></div>
            ))}</dl>
          </details>
          <p className="hint">Mage Path rules: {cg.magePathVersion}. All paths are self-reported and apply across your repository views.</p>
          <p>{cg.distinctions.evolveHint}</p>
        </section>

        <section className="panel" id="mastery" aria-labelledby="mastery-h">
          <h2 id="mastery-h">Earned Monarchs: the endgame after Rank S</h2>
          <p>Each specialty has a final achievement: reach Rank {guide.mastery.requiredRank}, record at least {guide.mastery.requiredContributions} qualifying contributions, and span {guide.mastery.requiredDistinctMonths} distinct UTC calendar months. All three gates must be met in the current scope. Contributions from before reaching S count toward the specialty gates.</p>
          <div className="class-guide">{guide.mastery.titles.map((item) => (
            <article key={item.id} className="class-card"><h3>{item.title}</h3><p>{item.unlock}</p></article>
          ))}</div>
          <p className="small">Technical specialties count your authored, merged engineering pull requests with matching topic signals. Documentation counts merged documentation pull requests and closed documentation issues; Review counts submitted reviews. Reviewing somebody else's backend change does not establish your authored backend specialty.</p>
          <p className="small">Rank S is calculated from the original progression achievements first. Monarch achievements cannot unlock themselves by raising your rank. The unlock date is when the last required gate was met in your contribution history, not the day you imported it.</p>
          <p>{guide.displayedTitleSelection}</p>
          <p className="small">These are evidence-backed game milestones, not verified professional qualifications. Mage Path quiz results—including the self-reported Intelligence Monarch—never unlock an earned specialty Monarch or change its progress. Imported metadata has classification limits.</p>
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
