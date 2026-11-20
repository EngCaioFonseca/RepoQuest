import { deriveRelicVault, RARITY_LABELS, RARITY_LIST } from "@/lib/client/relics";
import type { DashboardView } from "@/lib/client/types";
import { Meter, Panel } from "./Primitives";
import { QuestChest, RelicItemIcon } from "./VisualObjects";

export function RelicVault({ view }: { view: DashboardView }) {
  const vault = deriveRelicVault(view);
  return (
    <Panel
      id="vault"
      title="Relic vault & chests"
      hint="Tangible items, tokens, and treasure chests unlocked by your contributions in this view."
      summary={`${vault.unlockedCount} of ${vault.totalCount} relics forged, ${vault.chestsOpened} quest chest${vault.chestsOpened === 1 ? "" : "s"} opened`}
    >
      <div className="vault-banner">
        <QuestChest completed={vault.chestsOpened > 0} size="lg" />
        <div className="vault-summary">
          <div className="quest-top">
            <h3>{vault.unlockedCount} of {vault.totalCount} relics forged</h3>
            <span className="chip">{vault.chestsOpened} / {vault.chestsTotal} quest chests opened</span>
          </div>
          <Meter value={vault.unlockedCount} max={Math.max(vault.totalCount, 1)} label="Relic vault completion" />
          <ul className="rarity-bar" aria-label="Relics by rarity">
            {RARITY_LIST.map((r) => (
              <li key={r} className={`rarity-pill rarity-${r}`}>
                <span>{RARITY_LABELS[r]}</span>
                <b>{vault.byRarity[r].unlocked}/{vault.byRarity[r].total}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="relic-grid" aria-label="Collectible relics">
        {vault.items.map((item) => (
          <li key={item.id} className={`relic-card rarity-${item.rarity} ${item.unlocked ? "unlocked" : "locked"}`}>
            <RelicItemIcon relicId={item.id} rarity={item.rarity} unlocked={item.unlocked} />
            <div className="relic-body">
              <div className="relic-head">
                <h4>{item.name}</h4>
                <span className={`rarity-tag rarity-${item.rarity}`}>{RARITY_LABELS[item.rarity]}</span>
              </div>
              <p className="small">{item.unlocked ? `Unlocked via ${item.sourceLabel}` : item.unlockHint}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
