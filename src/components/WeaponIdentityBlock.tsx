import { getDevilFruit } from "../data/devilFruits";
import { ITEM_RARITY_LABELS } from "../data/items";
import type { InventoryItem, RunState } from "../models/types";
import { fruitStatusLabel } from "../services/DevilFruitService";
import { DevilFruitService } from "../services/DevilFruitService";
import { WeaponProgressionService } from "../services/WeaponProgressionService";
import { WeaponService } from "../services/WeaponService";
import { weaponRarityClass } from "../utils/weaponRarity";

type WeaponIdentityBlockProps = {
  run: RunState;
  item: InventoryItem;
  wielderId?: string | null;
  className?: string;
};

function pretty(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (ch) => ch.toUpperCase());
}

export function WeaponIdentityBlock({ run, item, wielderId, className = "" }: WeaponIdentityBlockProps) {
  const view = WeaponService.resolveWeaponView(item);
  const progress = WeaponProgressionService.ensure(item);
  const owner = wielderId ?? item.ownerCharacterId ?? run.player.id;
  const identity = WeaponProgressionService.identitySnapshot(item, owner);
  const rarityKey = (view?.rarity ?? identity.rarity) as keyof typeof ITEM_RARITY_LABELS;
  const rarityLabel = ITEM_RARITY_LABELS[rarityKey] ?? pretty(String(view?.rarity ?? identity.rarity));
  const fruitId = progress.devilFruit?.fruitId;
  const fruit = fruitId ? DevilFruitService.getState(run, fruitId) : undefined;
  const fruitDef = fruitId ? getDevilFruit(fruitId) : undefined;

  return (
    <section className={`weapon-identity ${className}`.trim()}>
      <p className="weapon-identity-kicker">Weapon identity</p>
      <dl className="weapon-identity-grid">
        <div className="weapon-identity-cell is-rarity">
          <dt>Rarity</dt>
          <dd className={weaponRarityClass(view?.rarity, view?.material)}>{rarityLabel}</dd>
        </div>
        <div className="weapon-identity-cell is-mastery">
          <dt>Current wielder mastery</dt>
          <dd>
            {identity.wielderMastery}
            <span className="weapon-identity-note">this weapon, not class</span>
          </dd>
        </div>
        <div className="weapon-identity-cell is-naming">
          <dt>Naming stage</dt>
          <dd>{identity.namingStage}</dd>
        </div>
        <div className="weapon-identity-cell is-name">
          <dt>Current name</dt>
          <dd>{identity.currentName}</dd>
        </div>
        <div className="weapon-identity-cell is-soul">
          <dt>Soul</dt>
          <dd>
            {identity.soul}
            {identity.soulTrait ? ` · ${pretty(identity.soulTrait)}` : ""}
          </dd>
        </div>
        <div className="weapon-identity-cell is-fruit">
          <dt>Devil Fruit</dt>
          <dd>
            {fruit
              ? `${fruit.identified === false ? "Unknown Devil Fruit" : fruitDef?.name ?? fruit.fruitId} — ${fruitStatusLabel(fruit.status)}${
                  fruit.hostWeaponName ? ` — Host: ${fruit.hostWeaponName}` : ""
                }`
              : "None"}
          </dd>
        </div>
        <div className="weapon-identity-cell is-seastone">
          <dt>Seastone</dt>
          <dd>
            {identity.seastone}
            {identity.seastoneFunctional ? " · functional" : ""}
          </dd>
        </div>
        <div className="weapon-identity-cell is-legacy">
          <dt>Legacy status</dt>
          <dd>{identity.legacy}</dd>
        </div>
      </dl>
    </section>
  );
}
