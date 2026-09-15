import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { Ability, RunState, StatName } from "../models/types";
import { getAbilitiesForCrewmember, getAbilitiesForPlayer } from "../data/abilities";
import { getDevilFruit } from "../data/devilFruits";
import { getWeapon } from "../data/weapons";
import { CORE_CREW_CAP } from "../game/constants";
import { resolveSkillBadges } from "../game/skillBadges";
import { techniqueHitChancePercent } from "../game/techniquePower";
import { useIsMobile } from "../hooks/useMediaQuery";
import { CharacterService } from "../services/CharacterService";
import { CrewService } from "../services/CrewService";
import { CrewCombatService, SUPPORT_ABILITIES } from "../services/CrewCombatService";
import { ProgressionService } from "../services/ProgressionService";
import { AffiliationService } from "../services/AffiliationService";
import { IdentityService } from "../services/IdentityService";
import { AuthorityService } from "../services/AuthorityService";
import { FleetService } from "../services/FleetService";
import { RaceService } from "../services/RaceService";
import { LootDispositionService } from "../services/LootDispositionService";
import { WeaponService } from "../services/WeaponService";
import { MedicalRecoveryService } from "../services/MedicalRecoveryService";
import {
  TargetResolutionService,
  targetingSummary,
} from "../services/TargetResolutionService";
import { STAT_LABELS } from "../utils/text";
import { ensurePlayerStats } from "../utils/stats";
import { CharacterCard } from "./CharacterCard";
import { HpBar } from "./HpBar";
import { ResourceBar } from "./ResourceBar";
import { MpService } from "../services/MpService";
import { OverlayFrame } from "./OverlayFrame";
import { SkillBadgeRow } from "./SkillBadgeRow";
import { WeaponStatsBlock } from "./WeaponStatsBlock";

type CrewOverlayProps = {
  run: RunState;
  onClose: () => void;
  onAssignStashWeapon?: (instanceId: string, characterId: string) => void;
  onAssignStashFruit?: (fruitId: string, characterId: string) => void;
};

type DragPayload =
  | { kind: "weapon"; instanceId: string }
  | { kind: "devil_fruit"; fruitId: string };

type CrewTab = "CORE" | "APPRENTICES" | "FLEET" | "COMMAND";
type SidePanelMode = "character" | "weapons";

const STAT_ORDER: StatName[] = ["strength", "defense", "speed", "willpower", "charisma", "intelligence"];
const EXTENDED_TABS: CrewTab[] = ["APPRENTICES", "FLEET", "COMMAND"];
const BATTLE_FORMATION_ROWS = 2;
const BATTLE_FORMATION_SLOTS = BATTLE_FORMATION_ROWS * 2;

function portraitInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
  }
  return name.slice(0, 2);
}

function crewStatsFor(character: ReturnType<typeof CharacterService.getCharacter>, strength: number) {
  if (character?.crewStats) {
    return ensurePlayerStats(character.crewStats);
  }
  return ensurePlayerStats({
    strength,
    defense: Math.max(1, strength - 1),
    speed: Math.max(1, strength - 2),
    willpower: Math.max(2, Math.floor(strength / 2)),
    charisma: 2,
  });
}

export function CrewOverlay({ run, onClose, onAssignStashWeapon, onAssignStashFruit }: CrewOverlayProps) {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<CrewTab>("CORE");
  const [sidePanel, setSidePanel] = useState<SidePanelMode>("character");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
  const crew = CrewService.list(run);
  const captain = CrewService.captainEntry(run);
  const captainFruit = run.player.devilFruitId ? getDevilFruit(run.player.devilFruitId) : undefined;
  const captainWeaponInstance = WeaponService.equippedInstanceFor(run, run.player.id);
  const captainWeapon = captainWeaponInstance?.name ?? CrewService.captainWeaponName(run);
  const crewLabel = AffiliationService.getCrewLabel(run);
  const leaderLabel = AffiliationService.getLeaderLabel(run);
  const affiliation = AffiliationService.summary(run);
  const authority = AuthorityService.get(run);
  CrewCombatService.ensurePartyConfig(run);
  const fleet = FleetService.list(run);
  const apprentices = FleetService.listApprentices(run);
  const showExtendedTabs =
    CrewService.isFleetUnlocked(run) ||
    run.runFlags.includes("crew_overflow_unlocked") ||
    (run.fleet?.length ?? 0) > 0;
  const fleetUnlockLine = CrewService.fleetUnlockSummary(run);
  const weaponRows = WeaponService.listCrewWeapons(run);
  const selectedWeaponRow = weaponRows.find((entry) => entry.instance.id === selectedWeaponId) ?? null;
  const selectedWeaponView = selectedWeaponRow
    ? WeaponService.resolveWeaponView(selectedWeaponRow.instance)
    : undefined;
  const stashFruits = LootDispositionService.stashItems(run).filter(
    (item) => item.type === "DEVIL_FRUIT" || item.fruitId,
  );

  const roster = useMemo(() => {
    const playerProgress = ProgressionService.getProgression(run, "player");
    const playerXp = ProgressionService.xpProgress(playerProgress);
    MpService.ensurePlayer(run.player);

    return [
      {
        id: run.player.id,
        name: captain.name,
        hp: { current: captain.hp, max: captain.maxHp },
        vitals: {
          hp: { current: captain.hp, max: captain.maxHp },
          mp: {
            current: run.player.mp ?? MpService.maxMpFor(run.player),
            max: run.player.maxMp ?? MpService.maxMpFor(run.player),
          },
          xp: { current: playerXp.current, max: playerXp.needed },
        },
        weapon: captainWeapon,
        weaponInstanceId: captainWeaponInstance?.id ?? null,
        fruit: captainFruit?.name ?? null,
        isCaptain: true,
        isActiveFighter: true,
        statusLine: MedicalRecoveryService.recoverySummary(run, "player"),
      },
      ...crew.map((entry) => {
        const hp = CrewService.estimatedHp(entry.character);
        const weaponInstance = WeaponService.equippedInstanceFor(run, entry.member.characterId);
        const weaponId = weaponInstance?.weaponDefinitionId ?? entry.character.weaponIds?.[0];
        const weapon = weaponId ? getWeapon(weaponId) : undefined;
        const fruit = entry.character.devilFruitId ? getDevilFruit(entry.character.devilFruitId) : undefined;
        const progression = ProgressionService.getProgression(run, entry.member.characterId);
        const xp = ProgressionService.xpProgress(progression);
        const stats = crewStatsFor(entry.character, entry.character.strength);
        const maxMp = MpService.maxMpForStats(stats);
        return {
          id: entry.member.characterId,
          name: entry.character.name,
          hp: { current: hp.hp, max: hp.maxHp },
          vitals: {
            hp: { current: hp.hp, max: hp.maxHp },
            mp: { current: maxMp, max: maxMp },
            xp: { current: xp.current, max: xp.needed },
          },
          weapon: weaponInstance?.name ?? weapon?.name ?? null,
          weaponInstanceId: weaponInstance?.id ?? null,
          fruit: fruit?.name ?? null,
          isCaptain: false,
          entry,
          statusLine: MedicalRecoveryService.recoverySummary(run, entry.member.characterId),
        };
      }),
    ];
  }, [captain, captainFruit, captainWeapon, captainWeaponInstance, crew, run]);

  const rosterSlots = useMemo(
    () => Array.from({ length: CORE_CREW_CAP }, (_, index) => roster[index] ?? null),
    [roster],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCharacterWeaponInstance =
    selectedId === run.player.id
      ? captainWeaponInstance
      : selectedId
        ? WeaponService.equippedInstanceFor(run, selectedId)
        : undefined;
  const selectedCharacterWeaponView = WeaponService.resolveWeaponView(selectedCharacterWeaponInstance);
  const selectedCrew =
    selectedId && selectedId !== run.player.id ? CrewService.getMember(run, selectedId) : null;
  const selectedCharacter =
    selectedId && selectedId !== run.player.id
      ? CharacterService.getCharacter(run, selectedId) ?? null
      : null;
  const playerProgress = ProgressionService.getProgression(run, "player");
  const playerXp = ProgressionService.xpProgress(playerProgress);
  const selectedCrewProgress =
    selectedId && selectedId !== run.player.id ? ProgressionService.getProgression(run, selectedId) : null;
  const selectedCrewXp = selectedCrewProgress ? ProgressionService.xpProgress(selectedCrewProgress) : null;
  const selectedCrewStats = selectedCharacter
    ? crewStatsFor(selectedCharacter, selectedCharacter.strength)
    : null;
  const selectedCrewMaxMp = selectedCrewStats ? MpService.maxMpForStats(selectedCrewStats) : 0;

  const handleDragStart = (event: DragEvent<HTMLElement>, payload: DragPayload) => {
    event.dataTransfer.setData("application/x-rogue-piece-gear", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const readDragPayload = (event: DragEvent): DragPayload | null => {
    const raw = event.dataTransfer.getData("application/x-rogue-piece-gear");
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  };

  const handleDropOnMember = (event: DragEvent<HTMLButtonElement>, characterId: string) => {
    event.preventDefault();
    setDropTargetId(null);
    const payload = readDragPayload(event);
    if (!payload) {
      return;
    }
    if (payload.kind === "weapon") {
      onAssignStashWeapon?.(payload.instanceId, characterId);
      return;
    }
    onAssignStashFruit?.(payload.fruitId, characterId);
  };

  useEffect(() => {
    const clearDropTarget = () => setDropTargetId(null);
    window.addEventListener("dragend", clearDropTarget);
    return () => window.removeEventListener("dragend", clearDropTarget);
  }, []);

  const rosterGridClassName = [
    "crew-roster-grid",
    isMobile ? "is-mobile-list" : "",
    selectedId ? "has-selection" : "",
    dropTargetId ? "is-drag-targeting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showMobileDetail = isMobile && tab === "CORE" && Boolean(selectedId);
  const showMobileList = isMobile && tab === "CORE" && !selectedId;

  const renderRosterSlot = (member: (typeof rosterSlots)[number], index: number) => {
    const isBattleSlot = index < BATTLE_FORMATION_SLOTS;
    const slotKey = member?.id ?? `open-${index}`;

    if (isMobile && !member) {
      return null;
    }

    return (
      <li className={isBattleSlot ? "crew-roster-slot-battle" : undefined} key={slotKey}>
        {member ? (
          <CharacterCard
            compact
            dropTarget={dropTargetId === member.id}
            fruitName={member.fruit}
            isActiveFighter={isBattleSlot}
            isCaptain={member.isCaptain}
            name={member.name}
            onClick={() => {
              setSelectedId(member.id);
              setSelectedWeaponId(null);
              setSidePanel("character");
            }}
            onDragLeave={() => setDropTargetId((current) => (current === member.id ? null : current))}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTargetId(member.id);
            }}
            onDrop={(event) => handleDropOnMember(event, member.id)}
            onWeaponDragStart={(event, instanceId) =>
              handleDragStart(event, { kind: "weapon", instanceId })
            }
            portraitInitials={portraitInitials(member.name)}
            primaryWeapon={member.weapon}
            selected={selectedId === member.id}
            statusLine={
              isMobile && isBattleSlot
                ? member.statusLine
                  ? `Battle · ${member.statusLine}`
                  : "Battle"
                : member.statusLine
            }
            vitals={member.vitals}
            weaponInstanceId={member.weaponInstanceId}
          />
        ) : (
          <div
            className={[
              "character-card",
              "character-card-empty",
              isBattleSlot ? "crew-roster-empty-battle" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p className="character-card-empty-label">Open slot</p>
          </div>
        )}
      </li>
    );
  };

  const renderSkillset = (characterId: string) => {
    const isCaptain = characterId === run.player.id;
    const abilities: Ability[] = isCaptain
      ? getAbilitiesForPlayer(run.player)
      : getAbilitiesForCrewmember(run, characterId);
    const level = isCaptain
      ? playerProgress.level
      : (ProgressionService.getProgression(run, characterId).level ?? 1);

    return (
      <section className="detail-section crew-skillset">
        <p className="detail-label">Skillset</p>
        {abilities.length === 0 ? (
          <p className="text-sm text-parchment-dim">No combat techniques unlocked yet.</p>
        ) : (
          <ul className="crew-skill-list">
            {abilities.map((ability) => {
              const mpCost = MpService.abilityMpCost(ability);
              const powerLevel = ability.powerLevel ?? Math.max(1, Math.round(ability.power / 1.5));
              const hitPct = techniqueHitChancePercent(powerLevel, level, ability.accuracyMod ?? 0);
              const targeting =
                ability.targeting ?? TargetResolutionService.legacyTargetingFromAbility(ability);
              const badges = resolveSkillBadges(ability);
              return (
                <li className="crew-skill-card" key={ability.id}>
                  <div className="crew-skill-card-main">
                    <p className="crew-skill-name font-display text-gold">{ability.name}</p>
                    <p className="crew-skill-desc">{ability.description}</p>
                    <p className="crew-skill-meta">
                      <span>Power Lv {powerLevel}</span>
                      <span>Acc ~{hitPct}%</span>
                      <span>{mpCost} MP</span>
                      <span>{targetingSummary(targeting)}</span>
                      {ability.scalingStat ? (
                        <span>Scales: {STAT_LABELS[ability.scalingStat]}</span>
                      ) : null}
                    </p>
                  </div>
                  {badges.length ? (
                    <SkillBadgeRow
                      badges={badges}
                      className="crew-skill-badges"
                      layout="row"
                      size={isMobile ? 40 : 48}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  const renderCharacterDetail = () => {
    if (selectedId === null) {
      return <p className="text-parchment-dim">Select a crewmate to view details.</p>;
    }
    if (selectedId === run.player.id) {
      return (
        <>
          <p className="hud-kicker">{leaderLabel}</p>
          <h3 className="font-display mt-2 text-2xl">{run.player.name}</h3>
          <section className="detail-section mt-3">
            <p className="detail-label">Identity</p>
            <p className="detail-value text-sm">Faction: {IdentityService.hudSummary(run).faction}</p>
            <p className="detail-value text-sm">Role: {IdentityService.hudSummary(run).role}</p>
            <p className="detail-value text-sm">Legal: {IdentityService.hudSummary(run).legal}</p>
            <p className="detail-value text-sm text-parchment-dim">
              Standing: {affiliation.rankLabel} · {affiliation.standingLabel}
            </p>
          </section>
          <section className="detail-section">
            <p className="detail-label">Vitals</p>
            <div className="detail-vitals-stack">
              <HpBar hp={run.player.hp} maxHp={run.player.maxHp} />
              <ResourceBar
                current={run.player.mp ?? MpService.maxMpFor(run.player)}
                kind="mp"
                max={run.player.maxMp ?? MpService.maxMpFor(run.player)}
              />
              <ResourceBar
                current={playerXp.current}
                kind="xp"
                max={playerXp.needed}
                label={`LV ${playerProgress.level}`}
              />
            </div>
          </section>
          {renderSkillset(run.player.id)}
          <section className="detail-section">
            <p className="detail-label">Stats</p>
            <ul className="detail-stat-list">
              {STAT_ORDER.map((stat) => (
                <li key={stat}>
                  <span>{STAT_LABELS[stat]}</span>
                  <span>{run.player.stats[stat]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-section">
            <p className="detail-label">Equipped weapon</p>
            {selectedCharacterWeaponView ? (
              <WeaponStatsBlock weapon={selectedCharacterWeaponView} />
            ) : (
              <p className="text-sm text-parchment-dim">No weapon equipped.</p>
            )}
          </section>
        </>
      );
    }
    if (selectedCrew && selectedCharacter) {
      return (
        <>
          <p className="hud-kicker">{CrewService.membershipLabel(selectedCrew.member.membership)}</p>
          <h3 className="font-display mt-2 text-2xl">{selectedCharacter.name}</h3>
          <section className="detail-section mt-3">
            <p className="detail-label">Role / AI</p>
            <p className="detail-value text-sm">
              {CrewService.roleLabel(selectedCrew.member.role)} · {selectedCrew.member.aiMode ?? "BALANCED"}
            </p>
            {selectedCrew.member.inActiveParty ? (
              <p className="text-sm text-gold">Active fighter</p>
            ) : selectedCrew.member.inSupportSlot ? (
              <p className="text-sm text-gold">Support slot</p>
            ) : null}
          </section>
          <section className="detail-section">
            <p className="detail-label">Vitals</p>
            <div className="detail-vitals-stack">
              <HpBar
                hp={CrewService.estimatedHp(selectedCharacter, selectedCrew.member).hp}
                maxHp={CrewService.estimatedHp(selectedCharacter, selectedCrew.member).maxHp}
              />
              <ResourceBar current={selectedCrewMaxMp} kind="mp" max={selectedCrewMaxMp} />
              {selectedCrewXp && selectedCrewProgress ? (
                <ResourceBar
                  current={selectedCrewXp.current}
                  kind="xp"
                  max={selectedCrewXp.needed}
                  label={`LV ${selectedCrewProgress.level}`}
                />
              ) : null}
            </div>
          </section>
          {renderSkillset(selectedId)}
          <section className="detail-section">
            <p className="detail-label">Stats</p>
            <ul className="detail-stat-list">
              {STAT_ORDER.map((stat) => {
                const stats = crewStatsFor(selectedCharacter, selectedCharacter.strength);
                return (
                  <li key={stat}>
                    <span>{STAT_LABELS[stat]}</span>
                    <span>{stats[stat]}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="detail-section">
            <p className="detail-label">Equipped weapon</p>
            {selectedCharacterWeaponView ? (
              <WeaponStatsBlock weapon={selectedCharacterWeaponView} />
            ) : (
              <p className="text-sm text-parchment-dim">No weapon equipped.</p>
            )}
          </section>
        </>
      );
    }
    return <p className="text-parchment-dim">Select a crewmate.</p>;
  };

  const renderWeaponsAssignList = (mode: "desktop" | "mobile") => (
    <div className="crew-weapons-panel">
      <p className="detail-label">
        {mode === "mobile"
          ? selectedWeaponId
            ? "Tap a weapon again to clear, or tap another to equip on this crewmate"
            : "Tap a weapon to equip it on this crewmate"
          : "Drag weapons onto crew cards — click to inspect stats"}
      </p>
      {weaponRows.length === 0 ? (
        <p className="text-sm text-parchment-dim">No weapons in the crew pack.</p>
      ) : (
        <ul className="crew-weapon-list">
          {weaponRows.map(({ instance, ownerLabel, ownerName }) => (
            <li key={instance.id}>
              <button
                className={`crew-weapon-row ${selectedWeaponId === instance.id ? "is-selected" : ""}`}
                draggable={mode === "desktop"}
                onClick={() => {
                  if (mode === "mobile" && selectedId) {
                    if (selectedWeaponId === instance.id) {
                      setSelectedWeaponId(null);
                      return;
                    }
                    onAssignStashWeapon?.(instance.id, selectedId);
                    setSelectedWeaponId(instance.id);
                    return;
                  }
                  setSelectedWeaponId((current) => (current === instance.id ? null : instance.id));
                }}
                onDragStart={(event) => handleDragStart(event, { kind: "weapon", instanceId: instance.id })}
                type="button"
              >
                <span className="crew-weapon-row-name font-display">{instance.name}</span>
                {ownerName ? (
                  <span className="crew-weapon-row-owner">{ownerName}</span>
                ) : (
                  <span className="crew-weapon-row-meta">{ownerLabel}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selectedWeaponView ? (
        <div className="crew-weapon-stats mt-3">
          <WeaponStatsBlock weapon={selectedWeaponView} />
        </div>
      ) : (
        <p className="text-sm text-parchment-dim mt-3">
          {mode === "mobile"
            ? "Select a weapon to see its stats and equip it."
            : "Select a weapon to see damage, speed, and other stats. Drag onto a crewmate to assign."}
        </p>
      )}
    </div>
  );

  return (
    <OverlayFrame eyebrow="SHIP" title={crewLabel} onClose={onClose}>
      <div className="crew-tabs">
        <button
          className={tab === "CORE" ? "crew-tab is-active" : "crew-tab"}
          onClick={() => setTab("CORE")}
          type="button"
        >
          CORE
        </button>
        {showExtendedTabs
          ? EXTENDED_TABS.map((entry) => (
              <button
                className={tab === entry ? "crew-tab is-active" : "crew-tab"}
                key={entry}
                onClick={() => setTab(entry)}
                type="button"
              >
                {entry}
              </button>
            ))
          : null}
      </div>

      {tab === "CORE" ? (
        <div
          className={[
            "split-overlay",
            "crew-split-overlay",
            isMobile ? "is-mobile-crew" : "",
            showMobileDetail ? "is-mobile-detail" : "",
            showMobileList ? "is-mobile-list-only" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {!showMobileDetail ? (
            <div className="split-pane crew-roster-pane">
              {fleetUnlockLine ? (
                <p className="text-sm text-parchment-dim crew-fleet-unlock-line">{fleetUnlockLine}</p>
              ) : null}
              <div className="crew-roster-wrap">
                {isMobile ? null : (
                  <>
                    <span className="crew-battle-formation-label">Battle Formation</span>
                    <div aria-hidden="true" className="crew-battle-formation-marker" />
                  </>
                )}
                <ul className={rosterGridClassName}>
                  {rosterSlots.map((member, index) => renderRosterSlot(member, index))}
                </ul>
              </div>
              {isMobile || stashFruits.length === 0 ? null : (
                <section className="crew-stash crew-stash-compact">
                  <p className="detail-label">Devil Fruits in pack — drag onto a crewmate</p>
                  <ul className="crew-stash-grid">
                    {stashFruits.map((item) => (
                      <li key={item.id}>
                        <button
                          className="crew-stash-chip"
                          draggable
                          onDragStart={(event) =>
                            handleDragStart(event, { kind: "devil_fruit", fruitId: item.fruitId! })
                          }
                          type="button"
                        >
                          <span className="crew-stash-chip-name">{item.name}</span>
                          <span className="crew-stash-chip-kind">Devil Fruit</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : null}

          {!showMobileList ? (
            <aside className="detail-panel panel crew-side-panel">
              {showMobileDetail ? (
                <div className="crew-mobile-detail-head">
                  <button
                    className="ghost-btn py-2"
                    onClick={() => {
                      setSelectedId(null);
                      setSelectedWeaponId(null);
                    }}
                    type="button"
                  >
                    ← Crew list
                  </button>
                </div>
              ) : (
                <div className="crew-side-toggle" role="tablist" aria-label="Crew detail">
                  <button
                    className={sidePanel === "character" ? "crew-side-toggle-btn is-active" : "crew-side-toggle-btn"}
                    onClick={() => setSidePanel("character")}
                    type="button"
                  >
                    Crewmate
                  </button>
                  <button
                    className={sidePanel === "weapons" ? "crew-side-toggle-btn is-active" : "crew-side-toggle-btn"}
                    onClick={() => setSidePanel("weapons")}
                    type="button"
                  >
                    Weapons
                  </button>
                </div>
              )}

              {showMobileDetail ? (
                <div className="crew-mobile-detail-body">
                  <div className="crew-mobile-detail-stats">{renderCharacterDetail()}</div>
                  <div className="crew-mobile-detail-weapons">{renderWeaponsAssignList("mobile")}</div>
                </div>
              ) : sidePanel === "weapons" ? (
                renderWeaponsAssignList("desktop")
              ) : (
                renderCharacterDetail()
              )}
            </aside>
          ) : null}
        </div>
      ) : null}

      {tab === "APPRENTICES" ? (
        <div className="panel">
          <p className="detail-label">Apprentices</p>
          {apprentices.length ? (
            <ul className="detail-history">
              {apprentices.map((entry) => {
                const character = CharacterService.getCharacter(run, entry.characterId);
                return (
                  <li key={entry.characterId}>
                    {character?.name ?? entry.characterId} · {CrewService.roleLabel(entry.role)} · progress{" "}
                    {entry.progress}%
                    <button className="ghost-btn ml-2" type="button">
                      Promote (stub)
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-parchment-dim">No apprentices yet. Promote promising allies from encounters.</p>
          )}
        </div>
      ) : null}

      {tab === "FLEET" ? (
        <div className="panel">
          <p className="detail-label">Named fleet captains</p>
          {fleetUnlockLine ? (
            <p className="text-sm text-parchment-dim mb-2">{fleetUnlockLine}</p>
          ) : null}
          {!CrewService.usesBountyFleet(run) ? (
            <p className="text-sm text-parchment-dim">
              Serving under a formal banner does not gather a personal pirate fleet. Leave that path if you want
              followers under your own bounty.
            </p>
          ) : fleet.length ? (
            <ul className="detail-history">
              {fleet.map((entry) => {
                const character = CharacterService.getCharacter(run, entry.characterId);
                return (
                  <li key={entry.characterId}>
                    {character?.name ?? entry.characterId} — {entry.shipName} · {entry.crewCount} crew ·{" "}
                    {entry.activity}
                  </li>
                );
              })}
            </ul>
          ) : CrewService.isFleetUnlocked(run) ? (
            <p className="text-sm text-parchment-dim">
              When core crew is full ({CORE_CREW_CAP}/{CORE_CREW_CAP}), new recruits may join as fleet captains under
              your banner — not as direct active crew.
            </p>
          ) : (
            <p className="text-sm text-parchment-dim">
              You are not yet known enough to gather followers under your banner. Raise your bounty to unlock the fleet.
            </p>
          )}
        </div>
      ) : null}

      {tab === "COMMAND" ? (
        <div className="panel">
          <section className="detail-section">
            <p className="detail-label">Authority</p>
            <p className="detail-value">
              {authority.score}/100 · {AuthorityService.stateLabel(authority.state)}
            </p>
          </section>
          <section className="detail-section">
            <p className="detail-label">Standing orders</p>
            <ul className="detail-history">
              {(run.standingOrders ?? []).map((order) => (
                <li key={order.id}>
                  <strong>{order.label}</strong> ({order.kind}) — {order.active ? "Active" : "Inactive"}
                  <p className="text-sm text-parchment-dim">{order.description}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-section">
            <p className="detail-label">Recent incidents</p>
            {(run.policyIncidents ?? []).length ? (
              <ul className="detail-history">
                {run.policyIncidents!.slice(-5).map((incident) => (
                  <li key={incident.id}>
                    Day {incident.day}: {incident.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-parchment-dim">No policy incidents recorded.</p>
            )}
          </section>
          <section className="detail-section">
            <p className="detail-label">Support abilities reference</p>
            <ul className="detail-history">
              {SUPPORT_ABILITIES.map((ability) => (
                <li key={ability.id}>
                  {ability.name} ({ability.role}): {ability.description}
                </li>
              ))}
            </ul>
          </section>
          <section className="detail-section">
            <p className="detail-label">Run race knowledge (sample)</p>
            <ul className="detail-history">
              {RaceService.ensureRunKnowledge(run)
                .filter((entry) => entry.discoveryState !== "UNKNOWN")
                .slice(0, 6)
                .map((entry) => (
                  <li key={entry.raceId}>
                    {entry.raceId}: {entry.discoveryState} · cultural {entry.culturalKnowledge} · recruit{" "}
                    {entry.normalRecruitmentUnlocked ? "unlocked" : "locked"}
                  </li>
                ))}
            </ul>
          </section>
        </div>
      ) : null}
    </OverlayFrame>
  );
}
