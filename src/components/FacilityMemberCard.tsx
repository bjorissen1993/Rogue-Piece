import type { RunState } from "../models/types";
import { getDevilFruit } from "../data/devilFruits";
import { AffiliationService } from "../services/AffiliationService";
import { AfflictionService } from "../services/AfflictionService";
import { CharacterScheduleService } from "../services/CharacterScheduleService";
import { CharacterService } from "../services/CharacterService";
import { CrewService } from "../services/CrewService";
import { MedicalRecoveryService } from "../services/MedicalRecoveryService";
import { MpService } from "../services/MpService";
import { ProgressionService } from "../services/ProgressionService";
import { CharacterCard } from "./CharacterCard";
import { factionPortraitSrc } from "./HudIcons";

type FacilityMemberCardProps = {
  run: RunState;
  characterId: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

function portraitInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
  }
  return name.slice(0, 2);
}

export function facilityMemberIds(run: RunState): string[] {
  const ids = [run.player.id, ...run.crew.map((member) => member.characterId)];
  return ids.filter((id, index) => ids.indexOf(id) === index);
}

export function FacilityMemberCard({ run, characterId, selected, disabled, onClick }: FacilityMemberCardProps) {
  const isPlayer = characterId === "player" || characterId === run.player.id;
  const id = isPlayer ? "player" : characterId;
  const name = ProgressionService.getDisplayName(run, id);
  const progress = ProgressionService.getProgression(run, id);
  const xp = ProgressionService.xpProgress(progress);
  const character = isPlayer ? null : CharacterService.getCharacter(run, id);
  const assignment = CharacterScheduleService.getAssignment(run, id);
  const recovering = assignment?.type === "RECOVERING" || assignment?.type === "HOSPITALIZED";
  const unavailable = !CharacterScheduleService.isAvailable(run, id) && !recovering;
  const poisoned = AfflictionService.isAfflicted(run, id);

  let hp = 0;
  let maxHp = 1;
  let mp = 0;
  let maxMp = 1;
  if (isPlayer) {
    MpService.ensurePlayer(run.player);
    hp = run.player.hp;
    maxHp = run.player.maxHp;
    mp = run.player.mp ?? 0;
    maxMp = run.player.maxMp ?? MpService.maxMpFor(run.player);
  } else {
    const vitals = CrewService.ensureMemberVitals(run, characterId);
    hp = vitals?.hp ?? 0;
    maxHp = vitals?.maxHp ?? 1;
    mp = vitals?.mp ?? 0;
    maxMp = vitals?.maxMp ?? 1;
  }

  const factionId = isPlayer
    ? AffiliationService.ensure(run).primaryFactionId ?? run.player.affiliation?.primaryFactionId
    : character?.relationFactionId ?? character?.faction ?? null;
  const fruitName = isPlayer
    ? null
    : character?.devilFruitId
      ? (getDevilFruit(character.devilFruitId)?.name ?? null)
      : null;

  return (
    <CharacterCard
      compact
      disabled={disabled}
      fruitName={fruitName}
      isCaptain={isPlayer}
      level={progress.level}
      name={name}
      onClick={onClick}
      poisonTip={AfflictionService.badgeTip(run, id)}
      poisoned={poisoned}
      portraitInitials={portraitInitials(name)}
      portraitSrc={factionPortraitSrc(factionId, isPlayer ? "leader" : "crew")}
      recovering={recovering}
      selected={selected}
      statusTip={
        recovering
          ? MedicalRecoveryService.recoverySummary(run, id)
          : CharacterScheduleService.busySummary(run, id)
      }
      unavailable={unavailable}
      vitals={{
        hp: { current: hp, max: maxHp },
        mp: { current: mp, max: maxMp },
        xp: { current: xp.current, max: xp.needed },
      }}
    />
  );
}

type FacilityActionCardProps = {
  kicker?: string;
  title: string;
  body?: string;
  iconSrc?: string;
  disabled?: boolean;
  active?: boolean;
  onClick?: () => void;
};

export function FacilityActionCard({
  kicker,
  title,
  body,
  iconSrc,
  disabled,
  active,
  onClick,
}: FacilityActionCardProps) {
  return (
    <button
      className={`facility-action${active ? " is-active" : ""}${iconSrc ? " has-art" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {iconSrc ? (
        <span className="facility-action-art-wrap" aria-hidden="true">
          <img alt="" className="facility-action-art" src={iconSrc} />
        </span>
      ) : null}
      {kicker ? <span className="facility-action-kicker">{kicker}</span> : null}
      <strong>{title}</strong>
      {body ? <span className="facility-action-body">{body}</span> : null}
    </button>
  );
}
