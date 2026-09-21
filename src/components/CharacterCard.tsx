import type { CSSProperties, DragEvent } from "react";
import { DEVIL_FRUITS } from "../data/devilFruits";
import type { WeaponType } from "../models/types";
import { splitCharacterDisplayName } from "../utils/text";
import { EffectTooltip } from "./EffectTooltip";
import {
  AFFLICTION_DOT_ART,
  DEVIL_FRUIT_BADGE_ART,
  DEVIL_FRUIT_ICON_FALLBACK,
  HudArt,
  RECOVERING_ART,
  UNAVAILABLE_ART,
  weaponIconSrc,
  type WeaponIconKind,
} from "./HudIcons";

export type VitalSnapshot = {
  current: number;
  max: number;
};

type CharacterCardProps = {
  portraitInitials: string;
  /** Faction circular portrait; falls back to initials when missing. */
  portraitSrc?: string | null;
  name: string;
  /** Optional epithet/title; otherwise parsed from `name` (e.g. "of the Coast"). */
  epithet?: string | null;
  /** Character level shown in the header XP ring. */
  level: number;
  vitals: {
    hp: VitalSnapshot;
    mp: VitalSnapshot;
    /** Progress toward next level (current / needed). */
    xp: VitalSnapshot;
  };
  primaryWeapon?: string | null;
  weaponInstanceId?: string | null;
  primaryWeaponType?: WeaponType | null;
  secondaryWeapon?: string | null;
  secondaryWeaponInstanceId?: string | null;
  secondaryWeaponType?: WeaponType | null;
  fruitName?: string | null;
  isCaptain?: boolean;
  isActiveFighter?: boolean;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  dropTarget?: boolean;
  /** Allow dragging this card to rearrange battle formation. */
  draggable?: boolean;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
  onMemberDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onWeaponDragStart?: (event: DragEvent<HTMLSpanElement>, instanceId: string) => void;
  /** e.g. RECOVERING · 2d or HOSPITALIZED · port — omitted when status badges are shown. */
  statusLine?: string | null;
  /** Hover tip for recovering / unavailable status badge (icon-tip). */
  statusTip?: string | null;
  /** Hospitalized / recovering after battle — Recovering.png badge. */
  recovering?: boolean;
  /** Busy / schedule blocks battle — Unavailable.png (hidden when recovering). */
  unavailable?: boolean;
  /** Poisoned / sick daily DoT — Affliction badge. */
  poisoned?: boolean;
  /** Hover tip for poison / sickness DoT badge. */
  poisonTip?: string | null;
};

type StatusBadge = {
  key: string;
  src: string;
  label: string;
  tip: string;
  kind: "recovering" | "unavailable" | "poison";
};

function devilFruitTip(fruitName: string): string {
  const fruit = DEVIL_FRUITS.find((entry) => entry.name === fruitName);
  if (!fruit) {
    return fruitName;
  }
  return `${fruit.name}\n${fruit.type} · Rarity ${fruit.rarity}`;
}

function levelXpTip(level: number, xpCurrent: number, xpNeeded: number): string {
  const pct = xpNeeded <= 0 ? 0 : Math.round(Math.max(0, Math.min(100, (xpCurrent / xpNeeded) * 100)));
  return `Level ${level}\n${xpCurrent}/${xpNeeded} XP (${pct}%)`;
}

function MiniVitalBar({
  current,
  kind,
  max,
}: {
  kind: "hp" | "mp";
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

function LevelRing({
  compact,
  level,
  xpCurrent,
  xpNeeded,
}: {
  compact?: boolean;
  level: number;
  xpCurrent: number;
  xpNeeded: number;
}) {
  const pct = xpNeeded <= 0 ? 0 : Math.max(0, Math.min(100, (xpCurrent / xpNeeded) * 100));
  const wideLevel = level >= 10;
  return (
    <EffectTooltip className="character-card-level-tip" tip={levelXpTip(level, xpCurrent, xpNeeded)}>
      <span
        className={[
          "character-card-level-ring",
          compact ? "is-compact" : "",
          wideLevel ? "is-wide-level" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--xp-pct": pct } as CSSProperties}
        aria-hidden="true"
      >
        <span className="character-card-level-ring-inner">
          <span className="character-card-level-value font-display">{level}</span>
        </span>
      </span>
      <span className="sr-only">
        Level {level}, {xpCurrent} of {xpNeeded} experience
      </span>
    </EffectTooltip>
  );
}

function WeaponSlot({
  compact,
  emptyIcon = "Unarmed",
  emptyTitle,
  instanceId,
  label,
  onWeaponDragStart,
  title,
  weaponType,
}: {
  compact?: boolean;
  emptyIcon?: WeaponIconKind;
  emptyTitle: string;
  instanceId?: string | null;
  label?: string | null;
  onWeaponDragStart?: (event: DragEvent<HTMLSpanElement>, instanceId: string) => void;
  title: string;
  weaponType?: WeaponType | null;
}) {
  const iconSrc = weaponIconSrc(weaponType, emptyIcon);
  const iconSize = compact ? 59 : 68;

  if (instanceId && label) {
    return (
      <span
        className="equip-slot equip-slot-weapon equip-draggable"
        draggable
        onClick={(event) => event.stopPropagation()}
        onDragStart={(event) => {
          event.stopPropagation();
          onWeaponDragStart?.(event, instanceId);
        }}
        title={`Drag to reassign ${label}`}
      >
        <span className="equip-slot-icon" aria-hidden="true">
          <HudArt size={iconSize} src={iconSrc} />
        </span>
        <span className="equip-slot-label">{label}</span>
      </span>
    );
  }
  return (
    <span className="equip-slot equip-slot-weapon equip-slot-empty" title={emptyTitle}>
      <span className="equip-slot-icon" aria-hidden="true">
        <HudArt size={iconSize} src={iconSrc} />
      </span>
      <span className="equip-slot-label">{title}</span>
    </span>
  );
}

export function CharacterCard({
  portraitInitials,
  portraitSrc,
  name,
  epithet,
  level,
  vitals,
  primaryWeapon,
  weaponInstanceId,
  primaryWeaponType,
  secondaryWeapon,
  secondaryWeaponInstanceId,
  secondaryWeaponType,
  fruitName,
  isCaptain,
  isActiveFighter,
  selected,
  compact,
  onClick,
  disabled,
  dropTarget,
  draggable,
  onDragOver,
  onDragLeave,
  onDrop,
  onMemberDragStart,
  onWeaponDragStart,
  statusLine,
  statusTip,
  recovering,
  unavailable,
  poisoned,
  poisonTip,
}: CharacterCardProps) {
  const badgeTip = statusTip ?? statusLine ?? null;
  const statusBadges: StatusBadge[] = [];
  if (recovering) {
    statusBadges.push({
      key: "recovering",
      src: RECOVERING_ART,
      label: "Recovering",
      tip: badgeTip ?? "Recovering",
      kind: "recovering",
    });
  } else if (unavailable) {
    statusBadges.push({
      key: "unavailable",
      src: UNAVAILABLE_ART,
      label: "Unavailable",
      tip: badgeTip ?? "Unavailable",
      kind: "unavailable",
    });
  }
  if (poisoned) {
    statusBadges.push({
      key: "poison",
      src: AFFLICTION_DOT_ART,
      label: "Afflicted",
      tip: poisonTip ?? "Poisoned / sick",
      kind: "poison",
    });
  }

  // Optical match to level/XP ring outer size (DF art ring is inset in the PNG).
  const fruitIconSize = compact ? 50 : 58;
  const statusBadgeSize = compact ? 68 : 82;
  const portraitSize = compact ? 317 : 370;
  const initials = portraitInitials.slice(0, 2).toUpperCase();
  const showStatusLine = Boolean(statusLine) && statusBadges.length === 0;
  const fruitTip = fruitName ? devilFruitTip(fruitName) : "";
  const { name: displayName, title: displayTitle } = splitCharacterDisplayName(name, epithet);

  return (
    <button
      className={[
        "character-card select-card",
        compact ? "character-card-compact" : "",
        isCaptain ? "is-captain" : "",
        isActiveFighter ? "is-active-fighter" : "",
        selected ? "is-selected" : "",
        dropTarget ? "is-drop-target" : "",
        recovering ? "is-recovering" : "",
        unavailable && !recovering ? "is-unavailable" : "",
        poisoned ? "is-poisoned" : "",
        draggable ? "is-formation-draggable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      draggable={draggable}
      onClick={onClick}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDragStart={draggable ? onMemberDragStart : undefined}
      onDrop={onDrop}
      type="button"
    >
      <div className="character-card-body">
        <div className="character-card-head">
          <LevelRing
            compact={compact}
            level={level}
            xpCurrent={vitals.xp.current}
            xpNeeded={vitals.xp.max}
          />
          <div className="character-card-head-text">
            <p className="font-display character-card-name">{displayName}</p>
            {displayTitle ? <p className="character-card-title">{displayTitle}</p> : null}
            {showStatusLine ? <p className="character-card-status">{statusLine}</p> : null}
          </div>
          <span className="character-card-fruit-slot" aria-hidden={fruitName ? undefined : true}>
            {fruitName ? (
              <EffectTooltip className="character-card-fruit-badge" tip={fruitTip}>
                <span className="character-card-fruit-badge-icon" aria-hidden="true">
                  <HudArt
                    fallbackSrc={DEVIL_FRUIT_ICON_FALLBACK}
                    size={fruitIconSize}
                    src={DEVIL_FRUIT_BADGE_ART}
                  />
                </span>
                <span className="sr-only">{fruitName}</span>
              </EffectTooltip>
            ) : null}
          </span>
        </div>

        <div className="character-card-portrait-stage">
          <div className="character-card-portrait-frame">
            <div
              className={["character-card-portrait", portraitSrc ? "has-art" : ""].filter(Boolean).join(" ")}
              aria-hidden="true"
            >
              {portraitSrc ? (
                <HudArt className="character-card-portrait-art" size={portraitSize} src={portraitSrc} />
              ) : (
                initials
              )}
            </div>
            {statusBadges.length ? (
              <div className="character-card-status-badges">
                {statusBadges.map((badge, index) => (
                  <EffectTooltip
                    className={[
                      "character-card-status-badge",
                      `is-${badge.kind}`,
                      index > 0 ? "is-stacked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={badge.key}
                    tip={badge.tip}
                  >
                    <HudArt
                      className="character-card-status-badge-art"
                      size={statusBadgeSize}
                      src={badge.src}
                    />
                    <span className="sr-only">{badge.label}</span>
                  </EffectTooltip>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="character-card-footer">
          <div className="character-card-vitals">
            <MiniVitalBar current={vitals.hp.current} kind="hp" max={vitals.hp.max} />
            <MiniVitalBar current={vitals.mp.current} kind="mp" max={vitals.mp.max} />
          </div>
          <div className="character-card-equipment">
            <WeaponSlot
              compact={compact}
              emptyTitle="No primary weapon"
              instanceId={weaponInstanceId}
              label={primaryWeapon}
              onWeaponDragStart={onWeaponDragStart}
              title="—"
              weaponType={primaryWeaponType}
            />
            <WeaponSlot
              compact={compact}
              emptyTitle="No secondary weapon"
              instanceId={secondaryWeaponInstanceId}
              label={secondaryWeapon}
              onWeaponDragStart={onWeaponDragStart}
              title="—"
              weaponType={secondaryWeaponType}
            />
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
