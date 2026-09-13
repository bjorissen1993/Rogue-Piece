import type { WeaponView } from "../services/WeaponService";
import { STAT_LABELS } from "../utils/text";

type WeaponStatsBlockProps = {
  weapon: WeaponView;
  compare?: WeaponView | null;
  className?: string;
};

function delta(shop: number, equipped: number | undefined): string {
  if (equipped == null) return String(shop);
  const diff = shop - equipped;
  if (diff === 0) return `${shop} (=)`;
  return `${shop} (${diff > 0 ? "+" : ""}${diff})`;
}

/** Compact weapon stat grid shared by shop and crew panels. */
export function WeaponStatsBlock({ weapon, compare, className = "" }: WeaponStatsBlockProps) {
  return (
    <div className={["weapon-stats-block", className].filter(Boolean).join(" ")}>
      <header className="weapon-stats-head">
        <h3 className="font-display text-gold">{weapon.name}</h3>
        <p className="weapon-stats-meta">
          {weapon.category ?? weapon.weaponType}
          {" · "}
          {weapon.weaponType}
          {" · "}
          {weapon.rarity}
          {weapon.isNamed ? " · Named" : ""}
        </p>
      </header>
      {weapon.special ? <p className="weapon-stats-special">{weapon.special}</p> : null}
      <dl className="weapon-shop-stats">
        <div>
          <dt>Damage</dt>
          <dd>{delta(weapon.damage, compare?.damage)}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd>{delta(weapon.speed, compare?.speed)}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{delta(weapon.accuracy, compare?.accuracy)}</dd>
        </div>
        <div>
          <dt>Reach</dt>
          <dd>{delta(weapon.reach, compare?.reach)}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{delta(weapon.weight, compare?.weight)}</dd>
        </div>
        <div>
          <dt>Crit</dt>
          <dd>+{(weapon as { critBonus?: number }).critBonus ?? 0}</dd>
        </div>
        <div>
          <dt>Scaling</dt>
          <dd>{weapon.scalingStat ? STAT_LABELS[weapon.scalingStat] : "—"}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>
            {weapon.quality ?? "—"}
            {weapon.material ? ` / ${weapon.material}` : ""}
          </dd>
        </div>
      </dl>
      {weapon.traits.length ? <p className="weapon-shop-traits">{weapon.traits.join(" · ")}</p> : null}
    </div>
  );
}
