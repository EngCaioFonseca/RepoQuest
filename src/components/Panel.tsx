"use client";
import { useSyncExternalStore } from "react";
import { isPanelOpen, panelSnapshot, serverPanelSnapshot, setPanelOpen, subscribePanels } from "@/lib/client/panels";

/**
 * A titled section whose body can be collapsed. Open state is remembered per browser.
 * `summary` stays visible when collapsed, so a closed panel still says something useful.
 */
export function Panel({ id, title, hint, children, actions, summary, defaultOpen = true, collapsible = true }: {
  id: string; title: string; hint?: string; children: React.ReactNode; actions?: React.ReactNode; summary?: React.ReactNode; defaultOpen?: boolean; collapsible?: boolean;
}) {
  const panels = useSyncExternalStore(subscribePanels, panelSnapshot, serverPanelSnapshot);
  const open = !collapsible || isPanelOpen(panels, id, defaultOpen);
  const bodyId = `${id}-body`;
  return (
    <section className={`panel${open ? "" : " collapsed"}`} id={id} aria-labelledby={`${id}-h`}>
      <header className="panel-head">
        <div className="panel-title">
          <h2 id={`${id}-h`}>
            {collapsible ? (
              <button type="button" className="panel-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setPanelOpen(id, !open)}>
                <span className="chev" aria-hidden="true">▸</span>{title}
              </button>
            ) : title}
          </h2>
          {hint && <p className="hint">{hint}</p>}
          {!open && summary && <p className="panel-summary small">{summary}</p>}
        </div>
        {actions}
      </header>
      <div id={bodyId} hidden={!open}>{children}</div>
    </section>
  );
}
