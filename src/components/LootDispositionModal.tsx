import { getDevilFruit } from "../data/devilFruits";
import { devilFruitIconSrc, inventoryItemIconSrc } from "../data/itemArt";
import { CrewService } from "../services/CrewService";
import { LootDispositionService } from "../services/LootDispositionService";
import type { PendingLootDisposition, RunState } from "../models/types";
import { FacilityActionCard, FacilityMemberCard } from "./FacilityMemberCard";
import { OverlayFrame } from "./OverlayFrame";

type LootDispositionModalProps = {
  run: RunState;
  pending: PendingLootDisposition;
  onBackpack: () => void;
  onAssign: (characterId: string) => void;
};

export function LootDispositionModal({ run, pending, onBackpack, onAssign }: LootDispositionModalProps) {
  const crew = CrewService.list(run);
  const roster = [
    run.player.id,
    ...crew.map((entry) => entry.member.characterId),
  ];
  const pendingArt =
    pending.kind === "devil_fruit"
      ? devilFruitIconSrc(getDevilFruit(pending.fruitId)?.type)
      : (() => {
          const weapon = run.player.inventory.find((item) => item.id === pending.instanceId);
          return weapon ? inventoryItemIconSrc(weapon) : "/icons/Items/Weapons/Sword/Cutlass1.png";
        })();

  return (
    <OverlayFrame elevate eyebrow="New gear" onClose={onBackpack} title={pending.label}>
      <span className="inventory-detail-art-wrap loot-disposition-art" aria-hidden="true">
        <img alt="" className="inventory-detail-art" src={pendingArt} />
      </span>
      <p className="encounter-choice-lede">
        {pending.kind === "weapon"
          ? "Who should carry this weapon? Only one person can wield it at a time."
          : "Who should receive this Devil Fruit? This choice is permanent."}
      </p>
      <div className="facility-crew-split">
        <ul className="facility-roster-grid">
          {roster.map((id) => (
            <li key={id}>
              <FacilityMemberCard characterId={id} onClick={() => onAssign(id)} run={run} />
            </li>
          ))}
        </ul>
        <aside className="detail-panel panel facility-detail">
          <FacilityActionCard
            body="Keep it in the pack until someone is ready for it."
            kicker="Hold"
            onClick={onBackpack}
            title="Store in backpack"
          />
        </aside>
      </div>
    </OverlayFrame>
  );
}

export function peekLootDisposition(run: RunState) {
  return LootDispositionService.peek(run);
}
