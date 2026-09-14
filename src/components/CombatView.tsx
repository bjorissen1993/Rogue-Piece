import { useEffect, useMemo, useRef, useState } from "react";
import {
  beatsFromLogAndHits,
  defeatBeats,
  presentationDurationMs,
  type CombatPresentationBeat,
} from "../game/combatPresentation";
import type { Ability, CombatHit, CombatState, CombatantState, InventoryItem } from "../models/types";
import { CombatPreviewService } from "../services/CombatPreviewService";
import { ItemService } from "../services/ItemService";
import { MpService } from "../services/MpService";
import { PartyCombatService } from "../services/PartyCombatService";
import { battleFormatLabel } from "../services/EncounterCompositionService";
import {
  TargetResolutionService,
  abilityNeedsManualTarget,
  primaryManualTargeting,
  targetingSummary,
} from "../services/TargetResolutionService";
import { useIsMobile } from "../hooks/useMediaQuery";
import { EffectTooltip } from "./EffectTooltip";
import { HpBar } from "./HpBar";
import { ResourceBar } from "./ResourceBar";
import { ActionIcon } from "./StatIcon";
import { ChoiceWheel, CHOICE_WHEEL_ICON_SIZE, type ChoiceWheelOption } from "./ChoiceWheel";
import { SkillBadgeRow } from "./SkillBadgeRow";
import { resolveSkillBadges, skillBadgeTip, SKILL_BADGE_CATALOG } from "../game/skillBadges";

const ACTION_ICON_SIZE = 190;
const WHEEL_ICON_SIZE = CHOICE_WHEEL_ICON_SIZE;
const ACTIVE_SIZE = 1.04;
const CARD_BASE_PCT = 20;
const CARD_BASE_PCT_MOBILE = 38;
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
    targetIds?: string[],
  ) => void;
  onUseItem: (itemId: string) => void;
  onResolveEnemyTurn: () => void;
  onFinishPresentation: () => void;
  zoanForms?: Array<{ id: string; label: string; description: string }>;
  currentZoanForm?: string | null;
  onSetZoanForm?: (formId: string) => void;
};

type Floater = CombatHit & { key: string };

type Targeting = null | {
  type: "ATTACK" | "TECHNIQUE" | "OBSERVE";
  abilityId?: string;
  selectedIds: string[];
};

type ActionMenu = "attack" | "technique" | "defend" | "observe" | "item" | "escape";

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

function CombatantCard({
  combatant,
  floaters,
  beatFlash,
  fallPending = false,
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
  beatFlash?: "HIT" | "MISS" | "HEAL" | "BLOCK" | "DEFEAT" | null;
  /** True while a fall beat is still queued/playing — keep upright until then. */
  fallPending?: boolean;
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
  const hit =
    beatFlash === "HIT" ||
    beatFlash === "BLOCK" ||
    floaters.some((entry) => entry.combatantId === combatant.id && entry.kind === "HIT");
  const heal =
    beatFlash === "HEAL" || floaters.some((entry) => entry.combatantId === combatant.id && entry.kind === "HEAL");
  const miss =
    beatFlash === "MISS" || floaters.some((entry) => entry.combatantId === combatant.id && entry.kind === "MISS");
  const defeatFlash = beatFlash === "DEFEAT";
  const blockFlash = beatFlash === "BLOCK";
  const isDown = combatant.hp <= 0;
  // Hit → fall anim → persistent KO. Don't gray/tilt until the fall has played.
  const showDown = isDown && !defeatFlash && !fallPending;
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
        className={`battler-card panel combat-party-card is-compact combat-unit ${isActive ? "is-active-turn" : ""} ${roleClass} ${showDown ? "is-down" : ""} ${hit ? "is-hit" : ""} ${heal ? "is-heal" : ""} ${miss ? "is-dodge" : ""} ${blockFlash ? "is-block" : ""} ${defeatFlash ? "is-defeat" : ""} ${facing === "down" ? "faces-down" : "faces-up"} ${selectable ? "is-selectable" : ""} ${selected ? "is-targeted" : ""} ${previewed ? "is-preview-target" : ""} ${combatant.enemyRole === "BOSS" ? "is-boss" : ""} ${combatant.enemyRole === "ELITE" ? "is-elite" : ""}`}
        onClick={selectable ? onSelect : undefined}
        type="button"
      >
        {combatant.enemyRole === "BOSS" ? <span className="combat-boss-badge">BOSS</span> : null}
        {combatant.enemyRole === "ELITE" ? <span className="combat-elite-badge">ELITE</span> : null}
        {position && !isActive && !isDown ? (
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

export function CombatView({
  combat,
  items,
  onAction,
  onUseItem,
  onResolveEnemyTurn,
  onFinishPresentation,
  zoanForms,
  currentZoanForm,
  onSetZoanForm,
}: CombatViewProps) {
  const isMobile = useIsMobile();
  const [actionMenu, setActionMenu] = useState<ActionMenu | null>(null);
  const [choicePhase, setChoicePhase] = useState<"open" | "closing" | null>(null);
  const [focusedOption, setFocusedOption] = useState<ChoiceWheelOption | null>(null);
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
  const finishPresentedRef = useRef(false);
  const finaleQueuedRef = useRef(false);
  const defeatedAnimPlayedRef = useRef<Set<string>>(new Set());

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
  const logTailId = combat.log.at(-1)?.id ?? "";
  const logLength = combat.log.length;
  const flashTargets = useMemo(() => new Set(currentBeat?.targetIds ?? []), [currentBeat]);
  const fallPendingIds = useMemo(() => {
    const ids = new Set<string>();
    if (!presenting) {
      return ids;
    }
    for (let index = beatIndex; index < beats.length; index += 1) {
      const beat = beats[index];
      if (beat?.animation !== "DEFEAT") {
        continue;
      }
      for (const id of beat.targetIds ?? []) {
        ids.add(id);
      }
    }
    return ids;
  }, [presenting, beatIndex, beats]);
  const beatFlashFor = (combatantId: string): "HIT" | "MISS" | "HEAL" | "BLOCK" | "DEFEAT" | null => {
    if (!currentBeat || !flashTargets.has(combatantId)) {
      return null;
    }
    if (currentBeat.animation === "DEFEAT") {
      return "DEFEAT";
    }
    if (currentBeat.animation === "DEFEND") {
      return "BLOCK";
    }
    if (currentBeat.amountKind === "MISS" || currentBeat.animation === "DODGE") {
      return "MISS";
    }
    if (currentBeat.amountKind === "HEAL" || currentBeat.animation === "HEAL") {
      return "HEAL";
    }
    if (
      currentBeat.amountKind === "HIT" ||
      currentBeat.animation === "IMPACT" ||
      currentBeat.animation === "MELEE_SLASH" ||
      currentBeat.animation === "MELEE_HEAVY" ||
      currentBeat.animation === "THRUST" ||
      currentBeat.animation === "PROJECTILE" ||
      currentBeat.animation === "AOE"
    ) {
      return "HIT";
    }
    return null;
  };
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

  const aoeAbility = Boolean(
    pendingAbility &&
      TargetResolutionService.abilityTechniqueEffects(pendingAbility).some(
        (effect) => effect.targeting.selection === "ALL",
      ),
  );
  const manualTargeting = pendingAbility ? primaryManualTargeting(pendingAbility) : null;
  const manualValidTargets = useMemo(() => {
    if (!targeting || !manualTargeting) {
      return [] as CombatantState[];
    }
    return TargetResolutionService.validManualTargets(combat, activeCombatant, manualTargeting);
  }, [targeting, manualTargeting, combat, activeCombatant]);
  const manualExact = manualTargeting?.exactCount;
  const manualMax = manualTargeting?.maxCount ?? manualExact ?? 1;
  const manualMin = manualTargeting?.minCount ?? (manualExact ?? 1);
  const selectedCount = targeting?.selectedIds.length ?? 0;
  const canConfirmManual =
    Boolean(targeting && manualTargeting) &&
    selectedCount >= manualMin &&
    selectedCount <= manualMax &&
    (manualExact == null || selectedCount === manualExact || (manualTargeting?.whenInsufficient === "REDUCE" && selectedCount >= manualMin));
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

  const beginTargetedAction = (next: { type: "ATTACK" | "TECHNIQUE" | "OBSERVE"; abilityId?: string }) => {
    if (next.type === "TECHNIQUE" && next.abilityId) {
      const ability = activeCombatant.abilities.find((entry) => entry.id === next.abilityId);
      if (ability) {
        const usable = TargetResolutionService.canUseAbility(combat, activeCombatant, ability);
        if (!usable.ok) {
          setActionHint(usable.reason ?? "Cannot use that technique.");
          return;
        }
        if (!abilityNeedsManualTarget(ability)) {
          onAction(next.type, next.abilityId);
          closeMenu();
          setTargeting(null);
          return;
        }
        const manual = primaryManualTargeting(ability);
        const valid = manual
          ? TargetResolutionService.validManualTargets(combat, activeCombatant, manual)
          : livingEnemies;
        if (valid.length === 1 && (manual?.exactCount ?? 1) === 1 && !manual?.maxCount) {
          onAction(next.type, next.abilityId, valid[0]!.id, [valid[0]!.id]);
          closeMenu();
          setTargeting(null);
          return;
        }
        closeMenu();
        setTargeting({ ...next, selectedIds: [] });
        setActionHint(manual ? targetingSummary(manual) : "Select targets.");
        return;
      }
    }

    if (livingEnemies.length === 1) {
      onAction(next.type, next.abilityId, livingEnemies[0].id, [livingEnemies[0].id]);
      closeMenu();
      setTargeting(null);
      return;
    }
    if (livingEnemies.length === 0) {
      return;
    }
    closeMenu();
    setTargeting({ ...next, selectedIds: [] });
    setActionHint(next.type === "OBSERVE" ? "Select an enemy to observe." : "Select a target.");
  };

  const fireTargetedAction = (targetIds: string[]) => {
    if (!targeting) {
      return;
    }
    onAction(targeting.type, targeting.abilityId, targetIds[0], targetIds);
    setTargeting(null);
    setActionHint(null);
  };

  const toggleManualTarget = (combatantId: string) => {
    if (!targeting) {
      return;
    }
    if (targeting.type !== "TECHNIQUE" || !manualTargeting) {
      fireTargetedAction([combatantId]);
      return;
    }
    const already = targeting.selectedIds.includes(combatantId);
    let nextIds = already
      ? targeting.selectedIds.filter((id) => id !== combatantId)
      : [...targeting.selectedIds, combatantId];
    if (!already && manualExact != null && nextIds.length > manualExact) {
      return;
    }
    if (!already && manualMax != null && nextIds.length > manualMax) {
      return;
    }
    // Single exact target: fire immediately
    if (manualExact === 1 && nextIds.length === 1) {
      fireTargetedAction(nextIds);
      return;
    }
    setTargeting({ ...targeting, selectedIds: nextIds });
    setActionHint(
      `${targetingSummary(manualTargeting)} · Selected ${nextIds.length}/${manualExact ?? manualMax}`,
    );
  };

  useEffect(() => {
    if (!currentBeat) {
      return;
    }
    if (currentBeat.amountKind && currentBeat.targetIds?.length) {
      const stamp = `${beatIndex}-${currentBeat.headline}`;
      setFloaters(
        currentBeat.targetIds.map((combatantId, index) => {
          const side =
            combat.enemies.some((entry) => entry.id === combatantId)
              ? "ENEMY"
              : "PLAYER";
          return {
            id: `${stamp}-${combatantId}`,
            combatantId,
            side,
            amount: currentBeat.amount ?? 0,
            kind: currentBeat.amountKind!,
            key: `${stamp}-${index}`,
          };
        }),
      );
      const clearTimer = window.setTimeout(() => setFloaters([]), 900);
      return () => window.clearTimeout(clearTimer);
    }
    return undefined;
  }, [currentBeat, beatIndex, combat.enemies]);

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
      // Remount mid-victory / after refresh: keep KO pose, skip intros + defeat replays.
      if (combat.finished) {
        const roster = [...PartyCombatService.allAllies(combat), ...combat.enemies];
        for (const entry of roster) {
          if (entry.hp <= 0) {
            defeatedAnimPlayedRef.current.add(entry.id);
          }
        }
        finaleQueuedRef.current = true;
        finishPresentedRef.current = true;
        seenLogId.current = combat.log.at(-1)?.id ?? "done";
        lastRound.current = combat.round;
        return;
      }
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

    // After the fight finale has played (or victory UI is up), never re-queue hit/defeat beats
    // when the parent re-persists the same finished combat (e.g. sequential level-ups).
    if (finaleQueuedRef.current || finishPresentedRef.current) {
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
    const roster = [...PartyCombatService.allAllies(combat), ...combat.enemies];
    const fallBeats = defeatBeats(roster, hits).filter((beat) => {
      const id = beat.targetIds?.[0];
      if (!id || defeatedAnimPlayedRef.current.has(id)) {
        return false;
      }
      defeatedAnimPlayedRef.current.add(id);
      return true;
    });
    nextBeats.push(...fallBeats);
    if (combat.finished) {
      finaleQueuedRef.current = true;
      if (combat.result === "WIN") {
        nextBeats.push({
          headline: "VICTORY",
          subline: "The clash is yours.",
          kind: "defeat",
        });
      } else if (combat.result === "LOSE") {
        nextBeats.push({
          headline: "DEFEAT",
          subline: "The clash is lost.",
          kind: "defeat",
        });
      } else if (combat.result === "ESCAPE") {
        nextBeats.push({
          headline: "ESCAPED",
          subline: "You break away from the fight.",
          kind: "basic",
        });
      } else if (combat.result === "SURRENDER") {
        nextBeats.push({
          headline: "SURRENDERED",
          subline: "You throw down your arms.",
          kind: "basic",
        });
      }
    }
    if (nextBeats.length) {
      setBeats(nextBeats);
      setBeatIndex(0);
    }
  }, [logTailId, logLength, combat.round, hitKey, combat.finished, combat.result]);

  useEffect(() => {
    if (!currentBeat) {
      return;
    }
    const timer = window.setTimeout(() => {
      setBeatIndex((index) => index + 1);
    }, presentationDurationMs(currentBeat.kind));
    return () => window.clearTimeout(timer);
  }, [currentBeat, beatIndex]);

  useEffect(() => {
    if (!combat.finished || presenting || finishPresentedRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      finishPresentedRef.current = true;
      setBeats([]);
      setBeatIndex(0);
      setFloaters([]);
      onFinishPresentation();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [combat.finished, presenting, onFinishPresentation]);

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
    toggleManualTarget(enemyId);
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

  const techniqueOptions: ChoiceWheelOption[] = activeCombatant.abilities.map((ability) => {
    const mpCost = MpService.abilityMpCost(ability);
    const canAfford = (activeCombatant.mp ?? 0) >= mpCost;
    const previewTech = CombatPreviewService.previewAttack(combat, ability, activeCombatant.id, livingEnemies[0]?.id);
    const badges = resolveSkillBadges(ability);
    const badgeTips = badges.map(
      (badge) => `${SKILL_BADGE_CATALOG[badge.id].label}: ${skillBadgeTip(badge)}`,
    );
    return {
      id: ability.id,
      title: ability.name,
      costLabel: `${mpCost} MP`,
      badges,
      hint: [
        ability.name,
        ability.description,
        ...badgeTips,
        targetingSummary(
          ability.targeting ?? TargetResolutionService.legacyTargetingFromAbility(ability),
        ),
        previewTech ? `Hit ${previewTech.hitChance}% · ${previewTech.damageMin}–${previewTech.damageMax} dmg` : null,
        `Cost ${mpCost} MP`,
        canAfford ? null : "Not enough MP",
      ]
        .filter(Boolean)
        .join("\n"),
      disabled: !canAfford || !TargetResolutionService.canUseAbility(combat, activeCombatant, ability).ok,
      icon: <ActionIcon name="technique" size={WHEEL_ICON_SIZE} />,
      onConfirm: () => beginTargetedAction({ type: "TECHNIQUE", abilityId: ability.id }),
    };
  });

  const itemOptions: ChoiceWheelOption[] = combatItems.map((item) => {
    const defId = item.itemId || item.id;
    return {
      id: item.id,
      title: item.name,
      costLabel: `×${item.quantity ?? 1}`,
      hint: ItemService.combatHint(
        defId,
        {
          hp: activeCombatant.hp,
          maxHp: activeCombatant.maxHp,
          mp: activeCombatant.mp ?? 0,
          maxMp: activeCombatant.maxMp ?? 0,
        },
        item.description,
      ),
      icon: <ActionIcon name="item" size={WHEEL_ICON_SIZE} />,
      onConfirm: () => {
        closeMenu();
        onUseItem(defId);
      },
    };
  });

  const defendHint = [defendInfo.title, defendInfo.body, defendInfo.tip].join("\n");
  const observeHint = [observeInfo.title, observeInfo.body, observeInfo.tip].join("\n");
  const attackHint = [
    "Attack",
    "A basic strike against one enemy.",
    attackPreview ? `Hit ${attackPreview.hitChance}% · ${attackPreview.damageMin}–${attackPreview.damageMax} dmg` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const menuOptions: ChoiceWheelOption[] = (() => {
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

  const cardBasePct = isMobile
    ? Math.min(CARD_BASE_PCT_MOBILE, Math.floor(92 / Math.max(allies.length, enemies.length, 1)))
    : CARD_BASE_PCT;

  const cardWidthPct = (isActiveCard: boolean, count: number, hasActiveInRow: boolean) => {
    if (count <= 0) {
      return cardBasePct;
    }
    if (!hasActiveInRow) {
      return cardBasePct;
    }
    if (count === 1) {
      return cardBasePct * ACTIVE_SIZE;
    }
    const total = cardBasePct * count;
    const activeWidth = cardBasePct * ACTIVE_SIZE;
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
        return "All valid enemies will be hit.";
      }
      if (manualTargeting) {
        return `${targetingSummary(manualTargeting)} · ${selectedCount}/${manualExact ?? manualMax}`;
      }
      return "SELECT TARGET";
    }
    if (actionMenu) {
      return null;
    }
    return null;
  })();

  const actionsLocked = waiting || presenting || enemyThinking;
  const menuOpen = Boolean(actionMenu);
  const choiceClosing = choicePhase === "closing";
  const choiceInfoActive = Boolean(actionMenu && !choiceClosing && actionHint);

  const choiceRail = (
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
            orientation={isMobile ? "horizontal" : "vertical"}
            showBadges={false}
            soloFocus={isMobile}
            stepRem={isMobile ? 9 : undefined}
          />
        </div>
      ) : null}
    </div>
  );

  const combatLogModal = (
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
  );

  return (
    <section
      className={[
        "combat-stage",
        "combat-battlefield",
        menuOpen ? (isMobile ? "has-mobile-wheel" : "has-side-wheel") : "",
        logOpen ? "is-log-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {combat.battleFormat ? (
        <p className="combat-format-banner">
          {battleFormatLabel(
            combat.battleFormat,
            allies.filter((entry) => entry.participating !== false).length,
            enemies.length,
          )}
          {combat.isFriendly ? " · Friendly" : ""}
        </p>
      ) : null}
      {zoanForms && zoanForms.length > 0 && onSetZoanForm ? (
        <div className="combat-zoan-forms" role="group" aria-label="Zoan forms">
          {zoanForms.map((form) => (
            <button
              className={`ghost-btn combat-zoan-form-btn ${currentZoanForm === form.id ? "is-selected" : ""}`}
              disabled={actionsLocked}
              key={form.id}
              onClick={() => onSetZoanForm(form.id)}
              title={form.description}
              type="button"
            >
              {form.label}
            </button>
          ))}
        </div>
      ) : null}

      {!presenting && !logOpen ? (
        <button
          className="ghost-btn combat-log-open"
          onClick={() => {
            closeMenu();
            setLogOpen(true);
          }}
          type="button"
        >
          Combat log
        </button>
      ) : null}

      <div className="combat-field-row combat-enemies">
        <div className="combat-unit-row">
          {enemies.map((enemy) => {
            const valid = !manualTargeting || manualValidTargets.some((entry) => entry.id === enemy.id);
            const isSelected = Boolean(targeting?.selectedIds.includes(enemy.id));
            const selectable =
              Boolean(targeting) &&
              enemy.hp > 0 &&
              !presenting &&
              !enemyThinking &&
              (targeting?.type !== "TECHNIQUE" || !manualTargeting || valid);
            return (
              <CombatantCard
                beatFlash={beatFlashFor(enemy.id)}
                combatant={enemy}
                facing="down"
                fallPending={fallPendingIds.has(enemy.id)}
                floaters={floaters}
                isActive={enemy.id === activeCombatant.id}
                key={enemy.id}
                onHover={(hovering) => setHoverTargetId(hovering ? enemy.id : null)}
                onSelect={() => chooseEnemy(enemy.id)}
                position={positions.get(enemy.id)}
                previewed={Boolean(
                  targeting &&
                    ((aoeAbility && enemy.hp > 0) ||
                      (manualTargeting && valid) ||
                      targeting.selectedIds.includes(enemy.id)),
                )}
                selectable={selectable}
                selected={isSelected || (hoverTargetId === enemy.id && Boolean(targeting))}
                widthPct={enemyWidth(enemy.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="combat-mid-row">
        <div className={`combat-center-stage ${logOpen && !isMobile ? "is-log-open" : ""}`}>
          {presenting ? (
            <button className="combat-stage-present" onClick={advancePresentation} type="button">
              <div className={`combat-stage-fx ${currentBeat?.animation ? `is-${currentBeat.animation.toLowerCase()}` : ""}`}>
                <p className="combat-stage-kicker">
                  {currentBeat?.animation === "DEFEAT"
                    ? "Fallen"
                    : currentBeat?.kind === "round"
                      ? "New round"
                      : currentBeat?.headline === "VICTORY"
                        ? "Victory"
                        : currentBeat?.headline === "DEFEAT"
                          ? "Defeat"
                          : "Combat"}
                </p>
                <h2 className="combat-stage-headline font-display">{currentBeat?.headline}</h2>
                {currentBeat?.subline ? <p className="combat-stage-sub">{currentBeat.subline}</p> : null}
                <p className="combat-stage-skip">Click to skip</p>
              </div>
            </button>
          ) : logOpen && !isMobile ? (
            combatLogModal
          ) : (
            <div className="combat-stage-idle">
              <div className="combat-stage-copy">
                {showTurnBanner && !enemyThinking && !combat.finished ? (
                  <h2 className="combat-stage-headline font-display combat-turn-banner-anim" key={activeCombatant.id}>
                    {idleHeadline}
                  </h2>
                ) : (
                  <>
                    {choiceInfoActive ? (
                      <div className="combat-skill-readout combat-info-fade" key={focusedOption?.id ?? actionHint ?? "info"}>
                        {focusedOption?.badges?.length ? (
                          <SkillBadgeRow
                            badges={focusedOption.badges}
                            className="combat-skill-readout-badges"
                            layout="row"
                            size={48}
                          />
                        ) : null}
                        <p className="combat-stage-sub combat-stage-hint">{actionHint}</p>
                      </div>
                    ) : enemyThinking || combat.finished ? (
                      <h2 className="combat-stage-headline font-display">{idleHeadline}</h2>
                    ) : null}
                    {choiceInfoActive ? null : centerSub ? (
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
                    {targeting ? (
                      <div className="combat-target-confirm-row combat-target-confirm-inline">
                        {manualTargeting && (manualExact == null || manualExact > 1 || (manualMax ?? 1) > 1) ? (
                          <button
                            className="gold-btn"
                            disabled={!canConfirmManual}
                            onClick={() => fireTargetedAction(targeting.selectedIds)}
                            type="button"
                          >
                            Confirm Targets ({selectedCount}/{manualExact ?? manualMax})
                          </button>
                        ) : null}
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
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {isMobile ? null : choiceRail}
      </div>

      <div className={`combat-field-row combat-allies ${menuOpen ? "is-choosing" : ""}`}>
        <div className="combat-unit-row">
          {allies.map((ally) => {
            const allyManual =
              manualTargeting &&
              (manualTargeting.group === "ALLY" ||
                manualTargeting.group === "OTHER_ALLY" ||
                manualTargeting.group === "SELF");
            const valid = allyManual
              ? manualValidTargets.some((entry) => entry.id === ally.id)
              : false;
            const isSelected = Boolean(targeting?.selectedIds.includes(ally.id));
            return (
              <CombatantCard
                beatFlash={beatFlashFor(ally.id)}
                combatant={ally}
                facing="up"
                fallPending={fallPendingIds.has(ally.id)}
                floaters={floaters}
                isActive={ally.id === activeCombatant.id && !waiting}
                isCaptain={ally.id === captainId}
                key={ally.id}
                onSelect={
                  targeting && allyManual && valid
                    ? () => toggleManualTarget(ally.id)
                    : undefined
                }
                position={positions.get(ally.id)}
                previewed={Boolean(targeting && allyManual && valid)}
                selectable={Boolean(targeting && allyManual && valid && !presenting && !enemyThinking)}
                selected={isSelected}
                widthPct={allyWidth(ally.id)}
              />
            );
          })}
        </div>
      </div>

      {isMobile ? choiceRail : null}

      {combat.finished ? null : (
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

      {logOpen && isMobile ? (
        <div className="combat-log-fullscreen" role="dialog" aria-label="Combat log">
          {combatLogModal}
        </div>
      ) : null}
    </section>
  );
}
