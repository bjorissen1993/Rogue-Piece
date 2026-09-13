import type { DragEvent } from "react";
import { HudIcon } from "./HudIcons";

export type VitalSnapshot = {
  current: number;
  max: number;
};

type CharacterCardProps = {
  portraitInitials: string;
  name: string;
  vitals: {
    hp: VitalSnapshot;
    mp: VitalSnapshot;
    xp: VitalSnapshot;
  };
  primaryWeapon?: string | null;
  weaponInstanceId?: string | null;
  fruitName?: string | null;
  isCaptain?: boolean;
  isActiveFighter?: boolean;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  dropTarget?: boolean;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
  onWeaponDragStart?: (event: DragEvent<HTMLSpanElement>, instanceId: string) => void;
  /** e.g. RECOVERING · 2d or HOSPITALIZED · port */
  statusLine?: string | null;
};

function MiniVitalBar({
  current,
  kind,
  max,
}: {
  kind: "hp" | "mp" | "xp";
  current: number;
  max: number;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className={`mini-vital-bar mini-vital-bar-${kind}`} title={`${kind.toUpperCase()} ${current}/${max}`}>
      <div className="mini-vital-track">
        <div className="mini-vital-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mini-vital-value">
        {current}/{max}
      </span>
    </div>
  );
}

export function CharacterCard({
  portraitInitials,
  name,
  vitals,
  primaryWeapon,
  weaponInstanceId,
  fruitName,
  isCaptain,
  isActiveFighter,
  selected,
  compact,
  onClick,
  disabled,
  dropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onWeaponDragStart,
  statusLine,
}: CharacterCardProps) {
  return (
    <button
      className={[
        "character-card select-card",
        compact ? "character-card-compact" : "",
        isCaptain ? "is-captain" : "",
        isActiveFighter ? "is-active-fighter" : "",
        selected ? "is-selected" : "",
        dropTarget ? "is-drop-target" : "",
        statusLine ? "is-recovering" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onClick}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      type="button"
    >
      {!compact ? (
        <div className="character-card-portrait" aria-hidden="true">
          {portraitInitials.slice(0, 2).toUpperCase()}
        </div>
      ) : null}
      <div className="character-card-body">
        <div className="character-card-head">
          <p className="font-display character-card-name">{name}</p>
          {statusLine ? <p className="character-card-status">{statusLine}</p> : null}
        </div>
        <div className="character-card-footer">
          <div className="character-card-vitals">
            <MiniVitalBar current={vitals.hp.current} kind="hp" max={vitals.hp.max} />
            <MiniVitalBar current={vitals.mp.current} kind="mp" max={vitals.mp.max} />
            <MiniVitalBar current={vitals.xp.current} kind="xp" max={vitals.xp.max} />
          </div>
          <div className="character-card-equipment">
            <span
              className={`equip-slot equip-slot-fruit equip-slot-bound ${fruitName ? "" : "equip-slot-vacant"}`}
              title={fruitName ?? "No fruit"}
            >
              <span className="equip-slot-icon" aria-hidden="true">
                <HudIcon name="fruit" size={compact ? 18 : 20} />
              </span>
              <span className="equip-slot-label">{fruitName ?? "—"}</span>
            </span>
            {weaponInstanceId && primaryWeapon ? (
              <span
                className="equip-slot equip-slot-weapon equip-draggable"
                draggable
                onClick={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  event.stopPropagation();
                  onWeaponDragStart?.(event, weaponInstanceId);
                }}
                title={`Drag to reassign ${primaryWeapon}`}
              >
                <span className="equip-slot-icon" aria-hidden="true">
                  <HudIcon name="blade" size={compact ? 18 : 20} />
                </span>
                <span className="equip-slot-label">{primaryWeapon}</span>
              </span>
            ) : (
              <span className="equip-slot equip-slot-weapon equip-slot-empty" title="No weapon">
                <span className="equip-slot-icon" aria-hidden="true">
                  <HudIcon name="blade" size={compact ? 18 : 20} />
                </span>
                <span className="equip-slot-label">—</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

type InventoryCardProps = {
  name: string;
  subtitle?: string;
  quantityLabel: string;
  selected?: boolean;
  onClick?: () => void;
};

export function InventoryCard({
  name,
  subtitle,
  quantityLabel,
  selected,
  onClick,
}: InventoryCardProps) {
  return (
    <button
      className={`inventory-card select-card collection-card ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      <p className="collection-card-title font-display inventory-card-name">{name}</p>
      {subtitle ? <p className="collection-card-subtitle inventory-card-sub">{subtitle}</p> : null}
      <span className="inventory-card-qty">{quantityLabel}</span>
    </button>
  );
}
