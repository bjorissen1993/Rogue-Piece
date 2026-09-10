import { useEffect, useMemo, useRef, useState, type ReactNode, type WheelEvent } from "react";
import {
  beatsFromLogAndHits,
  presentationDurationMs,
  type CombatPresentationBeat,
} from "../game/combatPresentation";
import type { Ability, CombatHit, CombatState, CombatantState, InventoryItem } from "../models/types";
import { CombatPreviewService } from "../services/CombatPreviewService";
import { ItemService } from "../services/ItemService";
import { MpService } from "../services/MpService";
import { PartyCombatService } from "../services/PartyCombatService";
import { EffectTooltip } from "./EffectTooltip";
import { HpBar } from "./HpBar";
import { ResourceBar } from "./ResourceBar";
import { ActionIcon } from "./StatIcon";

const ACTION_ICON_SIZE = 190;
const WHEEL_ICON_SIZE = 200;
const ACTIVE_SIZE = 1.04;
const CARD_BASE_PCT = 20;
const WHEEL_STEP_REM = 8.5;
const WHEEL_SIDE_SCALE = 0.74;
const WHEEL_ANIM_MS = 240;
const CHOICE_PANEL_MS = 340;
const TURN_BANNER_MS = 1000;
const ENEMY_THINK_MS = 1100;

type CombatViewProps = {
  combat: CombatState;
  items: InventoryItem[];
  onAction: (
    type: "ATTACK" | "TECHNIQUE" | "DEFEND" | "OBSERVE" | "ESCAPE" | "SURRENDER",
    abilityId?: string,
    targetId?: string,
  ) => void;
  onUseItem: (itemId: string) => void;
  onResolveEnemyTurn: () => void;
};

type Floater = CombatHit & { key: string };

type Targeting = null | { type: "ATTACK" | "TECHNIQUE" | "OBSERVE"; abilityId?: string };

type ActionMenu = "attack" | "technique" | "defend" | "observe" | "item" | "escape";

type WheelOption = {
  id: string;
  title: string;
  costLabel: string;
  hint: string;
  disabled?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
};

function hitSignature(hits: CombatHit[]): string {
  return hits.map((hit) => hit.id).join("|");
}

function initiativeTip(combatant: CombatantState, position: number | undefined): string {
  const speed = combatant.stats.speed;
  const variance = combatant.initiativeVariance ?? 0;
  const finalScore = combatant.initiativeScore ?? speed + variance;
  return [
    `TURN POSITION #${position ?? "—"}`,
    "",
    `Speed ${speed}`,
    variance ? `Initiative variance +${variance}` : "No extra initiative",
    `Final initiative ${finalScore}`,
  ].join("\n");
}

function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

function bridgeOffsets(count: number): number[] {
  if (count <= 1) {
    return [0];
  }
  // Always keep both sides populated (with wrap) so scroll animations stay filled.
  return [-2, -1, 0, 1, 2];
}

function ChoiceWheel({
  options,
  onHoverHint,
  onFocusChange,
  disabled,
}: {
  options: WheelOption[];
  onHoverHint: (hint: string | null) => void;
  onFocusChange: (option: WheelOption | null) => void;
  disabled?: boolean;
}) {
  const [focus, setFocus] = useState(0);
  const [motion, setMotion] = useState(0);
  const [instant, setInstant] = useState(false);
  const locked = useRef(false);
  const wheelLock = useRef(0);
  const multi = options.length > 1;

  useEffect(() => {
    setFocus(0);
    setMotion(0);
    locked.current = false;
  }, [options.length, options[0]?.id]);

  useEffect(() => {
    const current = options[wrapIndex(focus, options.length)] ?? null;
    onHoverHint(current?.hint ?? null);
    onFocusChange(current);
    return () => {
      onHoverHint(null);
      onFocusChange(null);
    };
  }, [focus, options.length, options[0]?.id, options[focus]?.id, onHoverHint, onFocusChange]);

  if (!options.length) {
    return <p className="combat-wheel-empty">No options available.</p>;
  }

  const rotate = (delta: number) => {
    if (disabled || locked.current || !multi || delta === 0) {
      return;
    }
    locked.current = true;
    setInstant(false);
    const dir = delta > 0 ? 1 : -1;
    setMotion(dir);
    window.setTimeout(() => {
      setInstant(true);
      setFocus((current) => wrapIndex(current + dir, options.length));
      setMotion(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setInstant(false);
          locked.current = false;
        });
      });
    }, WHEEL_ANIM_MS);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!multi || Math.abs(event.deltaY) < 2) {
      return;
    }
    const now = Date.now();
    if (now - wheelLock.current < WHEEL_ANIM_MS) {
      return;
    }
    wheelLock.current = now;
    rotate(event.deltaY > 0 ? 1 : -1);
  };

  const offsets = bridgeOffsets(options.length);

  return (
    <div className={`combat-choice-wheel-wrap ${multi ? "has-arrows" : "is-single"}`}>
      <div className="combat-choice-wheel-row">
        {multi ? (
          <button
            aria-label="Previous choice"
            className="combat-wheel-arrow"
            disabled={disabled || locked.current}
            onClick={() => rotate(-1)}
            type="button"
          >
            ‹
          </button>
        ) : null}
        <div className="combat-choice-wheel" onWheel={onWheel}>
          {offsets.map((offset) => {
            const option = options[wrapIndex(focus + offset, options.length)];
            const visual = offset - motion;
            const isFocus = Math.abs(visual) < 0.01;
            const absVisual = Math.abs(visual);
            const scale = isFocus ? 1 : absVisual >= 1.5 ? 0.62 : WHEEL_SIDE_SCALE;
            const opacity = isFocus ? 1 : absVisual >= 1.5 ? 0.4 : 0.78;
            // Same lowered focus seat as solo choices; sides sit slightly lower.
            const y = isFocus ? 0.45 : 0.95;
            return (
              <button
                className={`combat-wheel-option ${isFocus ? "is-focus" : ""} ${instant ? "is-instant" : ""} ${option.disabled ? "is-disabled" : ""}`}
                disabled={disabled}
                key={`slot-${offset}`}
                onClick={() => {
                  if (!isFocus) {
                    rotate(visual < 0 ? -1 : 1);
                    return;
                  }
                  if (!option.disabled) {
                    option.onConfirm();
                  }
                }}
                style={{
                  transform: `translateX(${visual * WHEEL_STEP_REM}rem) translateY(${y}rem) scale(${scale})`,
                  opacity,
                  zIndex: isFocus ? 12 : Math.max(1, 8 - Math.round(absVisual)),
                  cursor: "pointer",
                }}
                tabIndex={isFocus ? 0 : -1}
                type="button"
              >
                <span className="combat-wheel-icon">
                  {option.icon ?? <ActionIcon name="technique" size={WHEEL_ICON_SIZE} />}
                </span>
                <span className="combat-wheel-label">{option.title}</span>
                {isFocus ? <span className="combat-wheel-cost">{option.costLabel}</span> : null}
              </button>
            );
          })}
        </div>
        {multi ? (
          <button
            aria-label="Next choice"
            className="combat-wheel-arrow"
            disabled={disabled || locked.current}
            onClick={() => rotate(1)}
            type="button"
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CombatantCard({
  combatant,
  floaters,
  isActive,
  isCaptain,
  position,
  facing,
  selectable,
  selected,
  previewed,
  widthPct,
  onSelect,
  onHover,
}: {
  combatant: CombatantState;
  floaters: Floater[];
  isActive: boolean;
  isCaptain?: boolean;
  position?: number;
  facing: "down" | "up";
  selectable?: boolean;
  selected?: boolean;
  previewed?: boolean;
  widthPct: number;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  const hit = floaters.some((entry) => entry.combatantId === combatant.id && entry.kind === "HIT");
  const heal = floaters.some((entry) => entry.combatantId === combatant.id && entry.kind === "HEAL");
  const miss = floaters.some((entry) => entry.combatantId === combatant.id && entry.kind === "MISS");
  const isDown = combatant.hp <= 0;
  const isEnemy = combatant.side === "ENEMY";
  const roleClass = isEnemy ? "is-enemy" : isCaptain ? "is-captain" : "is-crewmate";

  const statusChips = useMemo(() => {
    const chips: { id: string; label: string; tip: string; tone?: string }[] = [];
    if (combatant.defending) {
      chips.push({
        id: "defending",
        label: "Guarding",
        tip: "Guarding — incoming damage is reduced until their next turn.",
      });
    }
    if (isDown) {
      chips.push({
        id: "ko",
        label: "KO",
        tip: "This combatant is knocked out.",
        tone: "is-danger",
      });
    }
    for (const effect of combatant.statusEffects) {
      chips.push({
        id: effect.id,
        label: effect.name,
        tip: CombatPreviewService.statusTip(effect),
      });
    }
    return chips;
  }, [combatant.defending, combatant.statusEffects, isDown]);

  const statusKey = statusChips.map((chip) => chip.id).join("|");
  const seenStatuses = useRef<Set<string> | null>(null);
  const [enteringStatuses, setEnteringStatuses] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const ids = statusKey ? statusKey.split("|") : [];
    if (!seenStatuses.current) {
      seenStatuses.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seenStatuses.current!.has(id));
    seenStatuses.current = new Set(ids);
    if (!fresh.length) {
      return;
    }
    setEnteringStatuses(new Set(fresh));
    const timer = window.setTimeout(() => setEnteringStatuses(new Set()), 420);
    return () => window.clearTimeout(timer);
  }, [statusKey]);

  return (
    <div
      className={`combat-unit-slot ${isActive ? "is-active-slot" : ""}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      style={{
        flex: `0 0 ${widthPct}%`,
        width: `${widthPct}%`,
        maxWidth: `${widthPct}%`,
      }}
    >
      <button
        className={`battler-card panel combat-party-card is-compact combat-unit ${isActive ? "is-active-turn" : ""} ${roleClass} ${isDown ? "is-down" : ""} ${hit ? "is-hit" : ""} ${heal ? "is-heal" : ""} ${miss ? "is-dodge" : ""} ${facing === "down" ? "faces-down" : "faces-up"} ${selectable ? "is-selectable" : ""} ${selected ? "is-targeted" : ""} ${previewed ? "is-preview-target" : ""}`}
        onClick={selectable ? onSelect : undefined}
        type="button"
      >
        {position && !isActive ? (
          <EffectTooltip className="combat-turn-badge-wrap" tip={initiativeTip(combatant, position)}>
            <span className="combat-turn-badge">#{position}</span>
          </EffectTooltip>
        ) : null}
        {floaters
          .filter((entry) => entry.combatantId === combatant.id)
          .map((entry) => (
            <span className={`damage-floater ${entry.kind === "HEAL" ? "is-heal" : ""}`} key={entry.key}>
              {entry.kind === "MISS" ? "DODGE" : entry.kind === "HEAL" ? `+${entry.amount}` : `-${entry.amount}`}
            </span>
          ))}
        <h3 className="font-display text-xl combat-unit-name">{combatant.name}</h3>
        {isActive ? <p className="combat-current-turn">CURRENT TURN</p> : null}
        {combatant.formation ? (
          <p className="combat-formation">{combatant.formation === "FRONT" ? "Front" : "Back"}</p>
        ) : null}
        {combatant.side === "ENEMY" && !combatant.revealed && !isDown ? (
          <p className="text-sm text-parchment-dim">HP hidden</p>
        ) : (
          <HpBar flash={hit} heal={heal} hp={combatant.hp} maxHp={combatant.maxHp} />
        )}
        {combatant.maxMp && (combatant.side === "PLAYER" || combatant.revealed) ? (
          <div className="mt-2">
            <ResourceBar current={combatant.mp ?? 0} kind="mp" max={combatant.maxMp} />
          </div>
        ) : null}
        <div className="combat-status-row" aria-live="polite">
          {statusChips.map((chip) => (
            <EffectTooltip key={chip.id} tip={chip.tip}>
              <span
                className={`status-chip ${chip.tone ?? ""} ${enteringStatuses.has(chip.id) ? "is-enter" : ""}`}
              >
                {chip.label}
              </span>
            </EffectTooltip>
          ))}
        </div>
      </button>
    </div>
  );
}

export function CombatView({ combat, items, onAction, onUseItem, onResolveEnemyTurn }: CombatViewProps) {
  const [actionMenu, setActionMenu] = useState<ActionMenu | null>(null);
  const [choicePhase, setChoicePhase] = useState<"open" | "closing" | null>(null);
  const [focusedOption, setFocusedOption] = useState<WheelOption | null>(null);
  const [targeting, setTargeting] = useState<Targeting>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [showTurnBanner, setShowTurnBanner] = useState(true);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [beats, setBeats] = useState<CombatPresentationBeat[]>([]);
  const [beatIndex, setBeatIndex] = useState(0);
  const seenLogId = useRef<string | null>(null);
  const startedRef = useRef(false);
  const lastRound = useRef(combat.round);
  const closeMenuTimer = useRef<number | null>(null);

  const allies = PartyCombatService.allAllies(combat).slice(0, 4);
  const enemies = combat.enemies.slice(0, 4);
  const livingEnemies = combat.enemies.filter((entry) => entry.hp > 0);
  const activeCombatant = PartyCombatService.getActiveCombatant(combat) ?? combat.playerCombatant;
  const captainId = combat.playerCombatant.id;
  const combatItems = ItemService.combatItems(items);
  const waiting = !PartyCombatService.isPlayerTurn(combat) || combat.finished;
  const enemyThinking = combat.activeSide === "ENEMY" && !combat.finished;
  const presenting = beats.length > 0 && beatIndex < beats.length;
  const currentBeat = presenting ? beats[beatIndex] : null;
  const hits = combat.lastHits ?? [];
  const hitKey = hitSignature(hits);
  const positions = useMemo(
    () => new Map(PartyCombatService.upcomingTurnPositions(combat).map((entry) => [entry.id, entry.position])),
    [combat],
  );

  const pendingAbility: Ability | null = useMemo(() => {
    if (!targeting || targeting.type !== "TECHNIQUE" || !targeting.abilityId) {
      return null;
    }
    return activeCombatant.abilities.find((ability) => ability.id === targeting.abilityId) ?? null;
  }, [targeting, activeCombatant.abilities]);

  const aoeAbility = Boolean(pendingAbility?.tags?.includes("AOE"));
  const previewTargetId = hoverTargetId ?? livingEnemies[0]?.id ?? null;
  const preview = useMemo(() => {
    if (!targeting) {
      return null;
    }
    return CombatPreviewService.previewAttack(combat, pendingAbility, activeCombatant.id, previewTargetId);
  }, [targeting, pendingAbility, combat, activeCombatant.id, previewTargetId]);

  const defendInfo = CombatPreviewService.defendPreview();
  const observeInfo = CombatPreviewService.observePreview(livingEnemies[0], activeCombatant.stats.willpower);
  const attackPreview = CombatPreviewService.previewAttack(combat, null, activeCombatant.id, livingEnemies[0]?.id);

  const closeMenu = () => {
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
      closeMenuTimer.current = null;
    }
    setActionMenu(null);
    setChoicePhase(null);
    setActionHint(null);
    setFocusedOption(null);
  };

  const closeMenuAnimated = () => {
    if (!actionMenu || choicePhase === "closing") {
      closeMenu();
      return;
    }
    setChoicePhase("closing");
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
    }
    closeMenuTimer.current = window.setTimeout(() => {
      closeMenuTimer.current = null;
      setActionMenu(null);
      setChoicePhase(null);
      setActionHint(null);
      setFocusedOption(null);
    }, CHOICE_PANEL_MS);
  };

  const beginTargetedAction = (next: NonNullable<Targeting>) => {
    if (livingEnemies.length === 1) {
      onAction(next.type, next.abilityId, livingEnemies[0].id);
      closeMenu();
      setTargeting(null);
      return;
    }
    if (livingEnemies.length === 0) {
      return;
    }
    closeMenu();
    setTargeting(next);
    setActionHint(next.type === "OBSERVE" ? "Select an enemy to observe." : "Select a target.");
  };

  useEffect(() => {
    if (!hits.length) {
      return;
    }
    setFloaters(hits.map((hit) => ({ ...hit, key: hit.id })));
    const timer = window.setTimeout(() => setFloaters([]), 900);
    return () => window.clearTimeout(timer);
  }, [hitKey]);

  useEffect(() => {
    setTargeting(null);
    setActionMenu(null);
    setChoicePhase(null);
    setActionHint(null);
    setFocusedOption(null);
    setLogOpen(false);
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
      closeMenuTimer.current = null;
    }
  }, [combat.round, combat.activeSide, combat.activeCombatantId]);

  useEffect(() => {
    if (!PartyCombatService.isPlayerTurn(combat) || combat.finished) {
      setShowTurnBanner(false);
      return;
    }
    setShowTurnBanner(true);
    const timer = window.setTimeout(() => setShowTurnBanner(false), TURN_BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [combat.activeCombatantId, combat.activeSide, combat.round, combat.finished]);

  useEffect(() => {
    if (!enemyThinking || presenting) {
      return;
    }
    const timer = window.setTimeout(() => {
      onResolveEnemyTurn();
    }, ENEMY_THINK_MS);
    return () => window.clearTimeout(timer);
  }, [enemyThinking, combat.activeCombatantId, combat.round, presenting, onResolveEnemyTurn]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      const names = combat.enemies.map((entry) => entry.name.toUpperCase()).join(" · ");
      setBeats([
        { headline: names || "ENCOUNTER", kind: "start" },
        {
          headline: combat.enemies.length === 1 ? "1 ENEMY" : `${combat.enemies.length} ENEMIES`,
          kind: "start",
        },
      ]);
      setBeatIndex(0);
      seenLogId.current = combat.log.at(-1)?.id ?? "start";
      lastRound.current = combat.round;
      return;
    }
    const nextBeats: CombatPresentationBeat[] = [];
    if (combat.round !== lastRound.current) {
      lastRound.current = combat.round;
      nextBeats.push({ headline: `ROUND ${combat.round}`, kind: "round" });
    }
    const lastId = seenLogId.current;
    const idx = lastId ? combat.log.findIndex((entry) => entry.id === lastId) : -1;
    const fresh = idx >= 0 ? combat.log.slice(idx + 1) : combat.log.slice(-6);
    seenLogId.current = combat.log.at(-1)?.id ?? lastId;
    nextBeats.push(...beatsFromLogAndHits(fresh, hits));
    if (nextBeats.length) {
      setBeats(nextBeats);
      setBeatIndex(0);
    }
  }, [combat.log, combat.round, hitKey]);

  useEffect(() => {
    if (!currentBeat) {
      return;
    }
    const timer = window.setTimeout(() => {
      setBeatIndex((index) => index + 1);
    }, presentationDurationMs(currentBeat.kind));
    return () => window.clearTimeout(timer);
  }, [currentBeat, beatIndex]);

  const advancePresentation = () => {
    if (!presenting) {
      return;
    }
    setBeatIndex(beats.length);
  };

  const chooseEnemy = (enemyId: string) => {
    if (!targeting) {
      return;
    }
    onAction(targeting.type, targeting.abilityId, enemyId);
    setTargeting(null);
    setActionHint(null);
  };

  const toggleMenu = (next: ActionMenu) => {
    setTargeting(null);
    if (closeMenuTimer.current) {
      window.clearTimeout(closeMenuTimer.current);
      closeMenuTimer.current = null;
    }
    if (actionMenu === next && choicePhase !== "closing") {
      closeMenuAnimated();
      return;
    }
    setActionMenu(next);
    setChoicePhase("open");
    setActionHint(null);
  };

  const techniqueOptions: WheelOption[] = activeCombatant.abilities.map((ability) => {
    const mpCost = MpService.abilityMpCost(ability);
    const canAfford = (activeCombatant.mp ?? 0) >= mpCost;
    const previewTech = CombatPreviewService.previewAttack(combat, ability, activeCombatant.id, livingEnemies[0]?.id);
    return {
      id: ability.id,
      title: ability.name,
      costLabel: `${mpCost} MP${ability.tags?.includes("AOE") ? " · AoE" : ""}`,
      hint: [
        ability.name,
        ability.description,
        previewTech ? `Hit ${previewTech.hitChance}% · ${previewTech.damageMin}–${previewTech.damageMax} dmg` : null,
        `Cost ${mpCost} MP`,
        canAfford ? null : "Not enough MP",
      ]
        .filter(Boolean)
        .join("\n"),
      disabled: !canAfford,
      icon: <ActionIcon name="technique" size={WHEEL_ICON_SIZE} />,
      onConfirm: () => beginTargetedAction({ type: "TECHNIQUE", abilityId: ability.id }),
    };
  });

  const itemOptions: WheelOption[] = combatItems.map((item) => ({
    id: item.id,
    title: item.name,
    costLabel: `×${item.quantity ?? 1}`,
    hint: `${item.name}\nUse this item in combat.`,
    icon: <ActionIcon name="item" size={WHEEL_ICON_SIZE} />,
    onConfirm: () => {
      closeMenu();
      onUseItem(item.itemId || item.id);
    },
  }));

  const defendHint = [defendInfo.title, defendInfo.body, defendInfo.tip].join("\n");
  const observeHint = [observeInfo.title, observeInfo.body, observeInfo.tip].join("\n");
  const attackHint = [
    "Attack",
    "A basic strike against one enemy.",
    attackPreview ? `Hit ${attackPreview.hitChance}% · ${attackPreview.damageMin}–${attackPreview.damageMax} dmg` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const menuOptions: WheelOption[] = (() => {
    switch (actionMenu) {
      case "attack":
        return [
          {
            id: "attack",
            title: "Attack",
            costLabel: "0 MP",
            hint: attackHint,
            icon: <ActionIcon name="attack" size={WHEEL_ICON_SIZE} />,
            onConfirm: () => beginTargetedAction({ type: "ATTACK" }),
          },
        ];
      case "technique":
        return techniqueOptions;
      case "defend":
        return [
          {
            id: "defend",
            title: "Defend",
            costLabel: "0 MP",
            hint: defendHint,
            icon: <ActionIcon name="defend" size={WHEEL_ICON_SIZE} />,
            onConfirm: () => {
              closeMenu();
              onAction("DEFEND");
            },
          },
        ];
      case "observe":
        return [
          {
            id: "observe",
            title: "Observe",
            costLabel: "0 MP",
            hint: observeHint,
            icon: <ActionIcon name="observe" size={WHEEL_ICON_SIZE} />,
            onConfirm: () => beginTargetedAction({ type: "OBSERVE" }),
          },
        ];
      case "item":
        return itemOptions;
      case "escape":
        return [
          {
            id: "escape",
            title: "Escape",
            costLabel: combat.canEscape ? "Attempt" : "Locked",
            hint: combat.canEscape ? "Attempt to leave the fight." : "Escape is not possible.",
            disabled: !combat.canEscape,
            icon: <ActionIcon name="escape" size={WHEEL_ICON_SIZE} />,
            onConfirm: () => {
              closeMenu();
              onAction("ESCAPE");
            },
          },
        ];
      default:
        return [];
    }
  })();

  const cardWidthPct = (isActiveCard: boolean, count: number, hasActiveInRow: boolean) => {
    if (count <= 0) {
      return CARD_BASE_PCT;
    }
    if (!hasActiveInRow) {
      return CARD_BASE_PCT;
    }
    if (count === 1) {
      return CARD_BASE_PCT * ACTIVE_SIZE;
    }
    const total = CARD_BASE_PCT * count;
    const activeWidth = CARD_BASE_PCT * ACTIVE_SIZE;
    const idleWidth = (total - activeWidth) / (count - 1);
    return isActiveCard ? activeWidth : idleWidth;
  };

  const allyHasActive = !waiting && allies.some((ally) => ally.id === activeCombatant.id);
  const enemyHasActive = enemies.some((enemy) => enemy.id === activeCombatant.id);
  const allyWidth = (allyId: string) =>
    cardWidthPct(allyId === activeCombatant.id && !waiting, allies.length, allyHasActive);
  const enemyWidth = (enemyId: string) =>
    cardWidthPct(enemyId === activeCombatant.id, enemies.length, enemyHasActive);

  const selectedAction =
    actionMenu ??
    (targeting?.type === "ATTACK"
      ? "attack"
      : targeting?.type === "OBSERVE"
        ? "observe"
        : targeting?.type === "TECHNIQUE"
          ? "technique"
          : null);

  const idleHeadline = combat.finished
    ? "THE CLASH IS OVER"
    : enemyThinking
      ? `${activeCombatant.name.toUpperCase()} IS DECIDING…`
      : `${activeCombatant.name.toUpperCase()}'S TURN`;

  const centerSub = (() => {
    if (logOpen) {
      return null;
    }
    if (showTurnBanner && !enemyThinking && !combat.finished) {
      return null;
    }
    if (combat.finished) {
      return undefined;
    }
    if (enemyThinking) {
      return "The foe weighs their next move.";
    }
    if (waiting) {
      return undefined;
    }
    if (targeting) {
      if (aoeAbility) {
        return "Select a target — all enemies will be hit.";
      }
      return "SELECT TARGET";
    }
    if (actionMenu) {
      return null;
    }
    return "Choose an action.";
  })();

  const actionsLocked = waiting || presenting || enemyThinking;
  const menuOpen = Boolean(actionMenu);
  const choiceClosing = choicePhase === "closing";
  const choiceInfoActive = Boolean(actionMenu && !choiceClosing && actionHint);

  return (
    <section className="combat-stage combat-battlefield">
      <div className="combat-field-row combat-enemies">
        <div className="combat-unit-row">
          {enemies.map((enemy) => (
            <CombatantCard
              combatant={enemy}
              facing="down"
              floaters={floaters}
              isActive={enemy.id === activeCombatant.id}
              key={enemy.id}
              onHover={(hovering) => setHoverTargetId(hovering ? enemy.id : null)}
              onSelect={() => chooseEnemy(enemy.id)}
              position={positions.get(enemy.id)}
              previewed={Boolean(targeting && aoeAbility && enemy.hp > 0)}
              selectable={Boolean(targeting && enemy.hp > 0 && !presenting && !enemyThinking)}
              selected={hoverTargetId === enemy.id && Boolean(targeting)}
              widthPct={enemyWidth(enemy.id)}
            />
          ))}
        </div>
      </div>

      <div className={`combat-center-stage ${logOpen ? "is-log-open" : ""}`}>
        {presenting ? (
          <button className="combat-stage-present" onClick={advancePresentation} type="button">
            <div className={`combat-stage-fx ${currentBeat?.animation ? `is-${currentBeat.animation.toLowerCase()}` : ""}`}>
              <p className="combat-stage-kicker">{currentBeat?.kind === "round" ? "New round" : "Combat"}</p>
              <h2 className="combat-stage-headline font-display">{currentBeat?.headline}</h2>
              {currentBeat?.subline ? <p className="combat-stage-sub">{currentBeat.subline}</p> : null}
              <p className="combat-stage-skip">Click to skip</p>
            </div>
          </button>
        ) : logOpen ? (
          <div className="combat-log-modal">
            <div className="combat-log-modal-head">
              <h3 className="font-display text-gold">Combat Log</h3>
              <button className="combat-log-close" onClick={() => setLogOpen(false)} type="button">
                Close
              </button>
            </div>
            <div className="combat-log-modal-body">
              {combat.log.slice(-40).map((entry) => (
                <p key={entry.id}>
                  {entry.text}
                  {entry.detail ? <span className="combat-log-detail"> — {entry.detail}</span> : null}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="combat-stage-idle">
            <div className="combat-stage-idle-top">
              <button className="ghost-btn combat-log-open" onClick={() => setLogOpen(true)} type="button">
                Combat log
              </button>
            </div>
            <div className="combat-stage-copy">
              {showTurnBanner && !enemyThinking && !combat.finished ? (
                <h2 className="combat-stage-headline font-display combat-turn-banner-anim" key={activeCombatant.id}>
                  {idleHeadline}
                </h2>
              ) : (
                <>
                  {enemyThinking || combat.finished ? (
                    <h2 className="combat-stage-headline font-display">{idleHeadline}</h2>
                  ) : null}
                  {choiceInfoActive ? (
                    <p className="combat-stage-sub combat-stage-hint combat-info-fade" key={actionHint ?? "info"}>
                      {actionHint}
                    </p>
                  ) : centerSub ? (
                    <p
                      className={`combat-stage-sub combat-stage-hint ${
                        !enemyThinking && !combat.finished ? "combat-stage-choose" : ""
                      }`}
                    >
                      {centerSub}
                    </p>
                  ) : null}
                  {preview && targeting ? (
                    <p className="combat-stage-preview combat-info-fade">
                      Hit {preview.hitChance}% · {preview.damageMin}–{preview.damageMax} dmg · {preview.costLabel}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={`combat-field-row combat-allies ${menuOpen ? "is-choosing" : ""}`}>
        <div className="combat-unit-row">
          {allies.map((ally) => (
            <CombatantCard
              combatant={ally}
              facing="up"
              floaters={floaters}
              isActive={ally.id === activeCombatant.id && !waiting}
              isCaptain={ally.id === captainId}
              key={ally.id}
              position={positions.get(ally.id)}
              widthPct={allyWidth(ally.id)}
            />
          ))}
        </div>
      </div>

      <div className={`combat-choice-rail ${menuOpen ? "is-open" : ""}`}>
        {menuOpen ? (
          <div
            className={`combat-choice-overlay ${choicePhase === "closing" ? "is-putting-in" : "is-pulling-out"}`}
            role="dialog"
            aria-label="Action choices"
          >
            <ChoiceWheel
              disabled={actionsLocked || choiceClosing}
              onFocusChange={setFocusedOption}
              onHoverHint={setActionHint}
              options={menuOptions}
            />
            <button
              className="gold-btn combat-wheel-confirm"
              disabled={actionsLocked || choiceClosing || !focusedOption || focusedOption.disabled}
              onClick={() => {
                if (focusedOption && !focusedOption.disabled) {
                  focusedOption.onConfirm();
                }
              }}
              type="button"
            >
              Confirm
            </button>
          </div>
        ) : null}
      </div>

      {combat.finished ? (
        <p className="text-gold combat-finished-note">The clash is over.</p>
      ) : (
        <div className="combat-actions-dock">
          <div className="combat-actions combat-actions-main">
            <button
              className={`combat-action-btn ${selectedAction === "attack" ? "is-selected" : ""}`}
              disabled={actionsLocked}
              onClick={() => toggleMenu("attack")}
              type="button"
            >
              <span className="combat-action-glow" aria-hidden="true" />
              <span className="combat-action-icon">
                <ActionIcon name="attack" size={ACTION_ICON_SIZE} />
              </span>
              <span className="combat-action-label">Attack</span>
            </button>
            <button
              className={`combat-action-btn ${selectedAction === "technique" ? "is-selected" : ""}`}
              disabled={actionsLocked || activeCombatant.abilities.length === 0}
              onClick={() => toggleMenu("technique")}
              type="button"
            >
              <span className="combat-action-glow" aria-hidden="true" />
              <span className="combat-action-icon">
                <ActionIcon name="technique" size={ACTION_ICON_SIZE} />
              </span>
              <span className="combat-action-label">Technique</span>
            </button>
            <button
              className={`combat-action-btn ${selectedAction === "defend" ? "is-selected" : ""}`}
              disabled={actionsLocked}
              onClick={() => toggleMenu("defend")}
              type="button"
            >
              <span className="combat-action-glow" aria-hidden="true" />
              <span className="combat-action-icon">
                <ActionIcon name="defend" size={ACTION_ICON_SIZE} />
              </span>
              <span className="combat-action-label">Defend</span>
            </button>
            <button
              className={`combat-action-btn ${selectedAction === "observe" ? "is-selected" : ""}`}
              disabled={actionsLocked}
              onClick={() => toggleMenu("observe")}
              type="button"
            >
              <span className="combat-action-glow" aria-hidden="true" />
              <span className="combat-action-icon">
                <ActionIcon name="observe" size={ACTION_ICON_SIZE} />
              </span>
              <span className="combat-action-label">Observe</span>
            </button>
            <button
              className={`combat-action-btn ${selectedAction === "item" ? "is-selected" : ""}`}
              disabled={actionsLocked || combatItems.length === 0}
              onClick={() => toggleMenu("item")}
              type="button"
            >
              <span className="combat-action-glow" aria-hidden="true" />
              <span className="combat-action-icon">
                <ActionIcon name="item" size={ACTION_ICON_SIZE} />
              </span>
              <span className="combat-action-label">Item</span>
            </button>
            <button
              className={`combat-action-btn ${selectedAction === "escape" ? "is-selected" : ""}`}
              disabled={actionsLocked}
              onClick={() => toggleMenu("escape")}
              type="button"
            >
              <span className="combat-action-glow" aria-hidden="true" />
              <span className="combat-action-icon">
                <ActionIcon name="escape" size={ACTION_ICON_SIZE} />
              </span>
              <span className="combat-action-label">Escape</span>
            </button>
          </div>
        </div>
      )}

      {targeting ? (
        <button
          className="ghost-btn combat-cancel-target"
          onClick={() => {
            setTargeting(null);
            setActionHint(null);
          }}
          type="button"
        >
          Cancel targeting
        </button>
      ) : null}
    </section>
  );
}
