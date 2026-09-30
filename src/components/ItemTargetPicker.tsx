import { CrewService } from "../services/CrewService";
import type { RunState } from "../models/types";
import { FacilityActionCard, FacilityMemberCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

export type ItemTargetOption = {
  id: string;
  name: string;
  detail?: string;
};

type ItemTargetPickerProps = {
  run?: RunState;
  itemLabel: string;
  prompt?: string;
  /** When set, only these ids are offered (e.g. living combat allies). */
  options?: ItemTargetOption[];
  onPick: (characterId: string) => void;
  onCancel: () => void;
};

export function buildCrewTargetOptions(run: RunState): ItemTargetOption[] {
  const captainVitals = `HP ${run.player.hp}/${run.player.maxHp}`;
  const crew = CrewService.list(run).map((entry) => {
    const vitals = CrewService.ensureMemberVitals(run, entry.member.characterId);
    return {
      id: entry.member.characterId,
      name: entry.character.name,
      detail: vitals ? `HP ${vitals.hp}/${vitals.maxHp}` : undefined,
    };
  });
  return [
    { id: run.player.id, name: run.player.name, detail: captainVitals },
    ...crew,
  ];
}

export function ItemTargetPicker({
  run,
  itemLabel,
  prompt,
  options,
  onPick,
  onCancel,
}: ItemTargetPickerProps) {
  const roster = options ?? (run ? buildCrewTargetOptions(run) : []);

  return (
    <OverlayFrame elevate eyebrow="Use item" onClose={onCancel} title={itemLabel}>
      <p className="encounter-choice-lede">{prompt ?? "Who should receive this?"}</p>
      {run ? (
        <ul className="facility-roster-grid">
          {roster.map((member) => (
            <li key={member.id}>
              <FacilityMemberCard characterId={member.id} onClick={() => onPick(member.id)} run={run} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="facility-action-grid">
          {roster.map((member) => (
            <FacilityActionCard
              body={member.detail}
              kicker="Target"
              key={member.id}
              onClick={() => onPick(member.id)}
              title={member.name}
            />
          ))}
        </div>
      )}
    </OverlayFrame>
  );
}
