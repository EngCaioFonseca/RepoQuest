import { percent } from "@/lib/client/format";
export { Panel } from "./Panel";

export function Meter({ value, max, label, tone = "gold" }: { value: number; max: number; label: string; tone?: string }) {
  const p = percent(value, max);
  return (
    <div className={`meter tone-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <span style={{ width: `${p}%` }} />
    </div>
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

export function RankSigil({ rank, size }: { rank: string; size?: "sm" | "md" }) {
  return (
    <div className={`sigil rank-${rank}${size === "sm" ? " sm" : ""}`} role="img" aria-label={`Local rank ${rank}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {rank === "S" && (
          <g className="crown-rays">
            <line x1="50" y1="0" x2="50" y2="8" />
            <line x1="22" y1="8" x2="27" y2="14" />
            <line x1="78" y1="8" x2="73" y2="14" />
            <polygon points="36,12 42,4 50,9 58,4 64,12" className="crown" />
          </g>
        )}
        {rank === "A" && (
          <g className="flourish">
            <path d="M12,35 L4,50 L12,65 M88,35 L96,50 L88,65" className="inner" />
          </g>
        )}
        <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" />
        <polygon points="50,16 80,33 80,67 50,84 20,67 20,33" className="inner" />
        {(rank === "B" || rank === "A" || rank === "S") && (
          <polygon points="50,11 85,50 50,89 15,50" className="inner diamond" />
        )}
        {(rank === "C" || rank === "D") && (
          <g className="rivets">
            <circle cx="50" cy="11" r="2.2" />
            <circle cx="50" cy="89" r="2.2" />
            {rank === "C" && (
              <>
                <circle cx="15" cy="31" r="2.2" />
                <circle cx="85" cy="31" r="2.2" />
                <circle cx="15" cy="69" r="2.2" />
                <circle cx="85" cy="69" r="2.2" />
              </>
            )}
          </g>
        )}
      </svg>
      <span>{rank}</span>
    </div>
  );
}
