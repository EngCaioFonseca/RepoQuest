import { percent } from "@/lib/client/format";

export function Meter({ value, max, label, tone = "gold" }: { value: number; max: number; label: string; tone?: string }) {
  const p = percent(value, max);
  return (
    <div className={`meter tone-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <span style={{ width: `${p}%` }} />
    </div>
  );
}

export function Panel({ id, title, hint, children, actions }: { id: string; title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="panel" id={id} aria-labelledby={`${id}-h`}>
      <header className="panel-head">
        <div>
          <h2 id={`${id}-h`}>{title}</h2>
          {hint && <p className="hint">{hint}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function RankSigil({ rank }: { rank: string }) {
  return (
    <div className={`sigil rank-${rank}`} role="img" aria-label={`Local rank ${rank}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" />
        <polygon points="50,16 80,33 80,67 50,84 20,67 20,33" className="inner" />
      </svg>
      <span>{rank}</span>
    </div>
  );
}
