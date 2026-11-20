// Which dashboard panels are expanded. View preference only, kept per browser.
const STORE = "repoquest.panels.v1";
type State = Record<string, boolean>;

let state: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (state) return state;
  state = {};
  try {
    const raw = localStorage.getItem(STORE);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") for (const [k, v] of Object.entries(parsed)) if (typeof v === "boolean") state[k] = v;
  } catch { /* storage unavailable */ }
  return state;
}

function write(next: State) {
  state = next;
  try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* ignore */ }
  for (const fn of listeners) fn();
}

export const subscribePanels = (fn: () => void): (() => void) => { listeners.add(fn); return () => listeners.delete(fn); };
export const panelSnapshot = (): State => read();
export const serverPanelSnapshot = (): State => ({});
export const isPanelOpen = (s: State, id: string, defaultOpen: boolean): boolean => s[id] ?? defaultOpen;
export const setPanelOpen = (id: string, open: boolean): void => write({ ...read(), [id]: open });
export const setPanelsOpen = (ids: readonly string[], open: boolean): void => write({ ...read(), ...Object.fromEntries(ids.map((id) => [id, open])) });
