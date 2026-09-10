import { MASTERY_RANK_ORDER, MASTERY_THRESHOLDS } from "../game/constants";
import { getTechnique, getWeapon, WEAPONS } from "../data/weapons";
import { getFightingStyle, getStyleTechnique } from "../data/fightingStyles";
import { techniqueToAbility } from "../game/techniqueAbility";
import type {
  Ability,
  InventoryItem,
  MasteryRank,
  Player,
  RunState,
  WeaponType,
} from "../models/types";
import { createId } from "../utils/ids";
import { CharacterService } from "./CharacterService";
import { LootDispositionService } from "./LootDispositionService";

function isWeaponItem(item: InventoryItem): boolean {
  return item.type === "WEAPON" || Boolean(item.weaponDefinitionId);
}

export const WeaponService = {
  defaultEquipment(): { primaryWeaponId: string | null; secondaryWeaponId: string | null } {
    return { primaryWeaponId: null, secondaryWeaponId: null };
  },

  defaultMastery(): Partial<Record<WeaponType, number>> {
    return {};
  },

  createWeaponInstance(weaponDefinitionId: string, ownerCharacterId: string | null = null): InventoryItem | null {
    const weapon = getWeapon(weaponDefinitionId);
    if (!weapon) {
      return null;
    }
    return {
      id: createId("wpn"),
      itemId: `weapon_${weaponDefinitionId}`,
      name: weapon.name,
      type: "WEAPON",
      description: `${weapon.weaponType} weapon (${weapon.rarity}).`,
      quantity: 1,
      weaponDefinitionId,
      ownerCharacterId,
      equipped: false,
      category: "WEAPONS",
    };
  },

  listOwnedWeapons(player: Player): InventoryItem[] {
    return player.inventory.filter(isWeaponItem);
  },

  findInstance(player: Player, instanceId: string): InventoryItem | undefined {
    return player.inventory.find((item) => item.id === instanceId && isWeaponItem(item));
  },

  findEquippedInstance(player: Player): InventoryItem | undefined {
    const equipId = player.equipment?.primaryWeaponId;
    if (equipId) {
      const byId = this.findInstance(player, equipId);
      if (byId) {
        return byId;
      }
      // Legacy: equipment stored definition id
      return player.inventory.find(
        (item) =>
          isWeaponItem(item) &&
          (item.weaponDefinitionId === equipId || item.itemId === `weapon_${equipId}` || item.equipped),
      );
    }
    return player.inventory.find((item) => isWeaponItem(item) && item.equipped);
  },

  /**
   * Grant a weapon into inventory (backpack) only.
   * Never equips implicitly — even if the primary slot is empty.
   * Pass `{ autoEquip: true }` only for character-creation / explicit init paths.
   */
  grantWeapon(run: RunState, weaponId: string, options?: { autoEquip?: boolean; ownerCharacterId?: string | null; skipDisposition?: boolean }): boolean {
    const instance = this.createWeaponInstance(weaponId, options?.ownerCharacterId ?? run.player.id);
    if (!instance) {
      return false;
    }
    instance.equipped = false;
    run.player.inventory.push(instance);
    if (options?.autoEquip === true) {
      this.equipInstance(run, instance.id, run.player.id);
    } else if (!options?.skipDisposition) {
      const weapon = getWeapon(weaponId);
      LootDispositionService.queue(run, {
        kind: "weapon",
        instanceId: instance.id,
        label: weapon?.name ?? weaponId,
      });
    }
    return true;
  },

  /** Equip by inventory instance id. Previous equipped weapon returns unequipped to backpack. */
  equipInstance(run: RunState, instanceId: string, ownerCharacterId: string = run.player.id): boolean {
    const instance = this.findInstance(run.player, instanceId);
    if (!instance?.weaponDefinitionId) {
      return false;
    }
    if (!run.player.equipment) {
      run.player.equipment = this.defaultEquipment();
    }

    for (const item of run.player.inventory) {
      if (
        isWeaponItem(item) &&
        item.equipped &&
        (item.ownerCharacterId === ownerCharacterId || !item.ownerCharacterId) &&
        item.id !== instanceId
      ) {
        item.equipped = false;
        item.ownerCharacterId = run.player.id;
      }
    }

    instance.equipped = true;
    instance.ownerCharacterId = ownerCharacterId;
    run.player.equipment.primaryWeaponId = instance.id;
    return true;
  },

  unequipInstance(run: RunState, instanceId: string): boolean {
    const instance = this.findInstance(run.player, instanceId);
    if (!instance?.equipped) {
      return false;
    }
    instance.equipped = false;
    instance.ownerCharacterId = run.player.id;
    if (run.player.equipment?.primaryWeaponId === instanceId) {
      run.player.equipment.primaryWeaponId = null;
    }
    const character = run.world.characters.find((entry) => entry.weaponIds?.includes(instance.weaponDefinitionId!));
    if (character && character.weaponIds?.[0] === instance.weaponDefinitionId) {
      character.weaponIds = [];
    }
    return true;
  },

  weaponOwnerLabel(run: RunState, item: InventoryItem): string {
    if (!item.weaponDefinitionId) {
      return "Stored in Backpack";
    }
    const ownerId = item.ownerCharacterId ?? run.player.id;
    if (!item.equipped) {
      if (ownerId === run.player.id) {
        return "Stored in Backpack";
      }
      const crew = run.world.characters.find((entry) => entry.id === ownerId);
      return crew ? `Held by ${crew.name}` : "Stored in Backpack";
    }
    if (ownerId === run.player.id) {
      return `Equipped by ${run.player.name}`;
    }
    const crew = run.world.characters.find((entry) => entry.id === ownerId);
    return crew ? `Equipped by ${crew.name}` : "Equipped";
  },

  /** Legacy helper: equip by weapon definition id (creates instance if missing). */
  equipPrimary(run: RunState, weaponId: string): boolean {
    const existing = run.player.inventory.find(
      (item) => isWeaponItem(item) && item.weaponDefinitionId === weaponId && !item.equipped,
    );
    if (existing) {
      return this.equipInstance(run, existing.id);
    }
    const equipped = this.findEquippedInstance(run.player);
    if (equipped?.weaponDefinitionId === weaponId) {
      return true;
    }
    const created = this.createWeaponInstance(weaponId, run.player.id);
    if (!created) {
      return false;
    }
    run.player.inventory.push(created);
    return this.equipInstance(run, created.id);
  },

  /** Give a weapon instance to a crewmate (unequips previous crew weapon back to backpack). */
  assignToCrew(run: RunState, instanceId: string, characterId: string): { ok: boolean; reason: string } {
    const instance = this.findInstance(run.player, instanceId);
    if (!instance?.weaponDefinitionId) {
      return { ok: false, reason: "That weapon is not in your pack." };
    }
    const weapon = getWeapon(instance.weaponDefinitionId);
    if (!weapon) {
      return { ok: false, reason: "Unknown weapon." };
    }
    const character = run.world.characters.find((entry) => entry.id === characterId);
    if (!character) {
      return { ok: false, reason: "Crewmate not found." };
    }
    if (!run.crew.some((member) => member.characterId === characterId)) {
      return { ok: false, reason: `${character.name} is not in your crew.` };
    }

    // Return previous crew-owned weapon to backpack
    for (const item of run.player.inventory) {
      if (isWeaponItem(item) && item.ownerCharacterId === characterId && item.id !== instanceId) {
        item.ownerCharacterId = run.player.id;
        item.equipped = false;
      }
    }

    if (instance.equipped && run.player.equipment?.primaryWeaponId === instance.id) {
      run.player.equipment.primaryWeaponId = null;
    }
    instance.equipped = true;
    instance.ownerCharacterId = characterId;
    character.weaponIds = [instance.weaponDefinitionId];
    return { ok: true, reason: `${character.name} now carries the ${weapon.name}.` };
  },

  equippedInstanceFor(run: RunState, characterId: string): InventoryItem | undefined {
    return run.player.inventory.find(
      (item) =>
        isWeaponItem(item) &&
        item.equipped &&
        (item.ownerCharacterId ?? run.player.id) === characterId,
    );
  },

  listCrewWeapons(run: RunState): Array<{ instance: InventoryItem; ownerLabel: string; ownerName: string | null }> {
    return this.listOwnedWeapons(run.player)
      .map((instance) => {
        const ownerLabel = this.weaponOwnerLabel(run, instance);
        const equippedMatch = ownerLabel.match(/^Equipped by (.+)$/);
        const heldMatch = ownerLabel.match(/^Held by (.+)$/);
        return {
          instance,
          ownerLabel,
          ownerName: equippedMatch?.[1] ?? heldMatch?.[1] ?? null,
        };
      })
      .sort((a, b) => {
        if (a.instance.equipped !== b.instance.equipped) {
          return a.instance.equipped ? -1 : 1;
        }
        return a.instance.name.localeCompare(b.instance.name);
      });
  },

  canCrewEquip(run: RunState, instanceId: string, characterId: string): { ok: boolean; reason: string } {
    const instance = this.findInstance(run.player, instanceId);
    const character = run.world.characters.find((entry) => entry.id === characterId);
    if (!instance?.weaponDefinitionId || !character) {
      return { ok: false, reason: "Cannot assign that." };
    }
    const weapon = getWeapon(instance.weaponDefinitionId);
    if (!weapon) {
      return { ok: false, reason: "Unknown weapon." };
    }
    // Soft role restriction: snipers prefer guns, swordsmen prefer swords, etc.
    const role = run.crew.find((member) => member.characterId === characterId)?.role;
    if (role === "SNIPER" && weapon.weaponType !== "GUN") {
      return { ok: false, reason: `${character.name} cannot equip ${weapon.weaponType === "SPEAR" ? "Spears" : weapon.weaponType.toLowerCase() + "s"} as a sniper.` };
    }
    if (role === "SWORDSMAN" && weapon.weaponType !== "SWORD") {
      return { ok: false, reason: `${character.name} cannot equip ${weapon.name} — swordsmen use blades.` };
    }
    return { ok: true, reason: "" };
  },

  getEquippedWeaponId(player: Player): string | null {
    const instance = this.findEquippedInstance(player);
    if (instance?.weaponDefinitionId) {
      return instance.weaponDefinitionId;
    }
    const raw = player.equipment?.primaryWeaponId ?? null;
    if (raw && getWeapon(raw)) {
      return raw;
    }
    return null;
  },

  getEquippedWeapon(player: Player) {
    const id = this.getEquippedWeaponId(player);
    return id ? getWeapon(id) : undefined;
  },

  addMastery(run: RunState, weaponType: WeaponType, amount = 1): number {
    if (!run.player.weaponMastery) {
      run.player.weaponMastery = this.defaultMastery();
    }
    const current = run.player.weaponMastery[weaponType] ?? 0;
    const next = current + amount;
    run.player.weaponMastery[weaponType] = next;
    return next;
  },

  getMastery(player: Player, weaponType: WeaponType): number {
    return player.weaponMastery?.[weaponType] ?? 0;
  },

  getMasteryRank(player: Player, weaponType: WeaponType): MasteryRank {
    const value = this.getMastery(player, weaponType);
    let rank: MasteryRank = "BEGINNER";
    for (const entry of MASTERY_RANK_ORDER) {
      const threshold = MASTERY_THRESHOLDS[entry] ?? 0;
      if (value >= threshold) {
        rank = entry;
      }
    }
    return rank;
  },

  rankLabel(rank: MasteryRank): string {
    return rank.charAt(0) + rank.slice(1).toLowerCase();
  },

  techniquesForPlayer(player: Player): Ability[] {
    const abilities: Ability[] = [];
    const equipped = this.getEquippedWeapon(player);
    if (equipped) {
      for (const techId of equipped.techniqueIds) {
        const tech = getTechnique(techId);
        if (tech) {
          abilities.push(techniqueToAbility(tech));
        }
      }
    }
    for (const techId of player.unlockedTechniques ?? []) {
      const tech = getTechnique(techId);
      if (tech && !abilities.some((entry) => entry.id === tech.id)) {
        abilities.push(techniqueToAbility(tech));
      }
    }
    const styleId = player.activeCombatStyle;
    if (styleId) {
      const style = getFightingStyle(styleId);
      if (style) {
        for (const techId of style.techniqueIds.slice(0, 3)) {
          const tech = getStyleTechnique(techId);
          if (tech && !abilities.some((entry) => entry.id === tech.id)) {
            abilities.push(techniqueToAbility(tech));
          }
        }
      }
    }
    return abilities;
  },

  techniquesForCharacter(run: RunState, characterId: string): Ability[] {
    const abilities: Ability[] = [];
    const instance = this.equippedInstanceFor(run, characterId);
    const weapon = instance?.weaponDefinitionId ? getWeapon(instance.weaponDefinitionId) : undefined;
    if (weapon) {
      for (const techId of weapon.techniqueIds) {
        const tech = getTechnique(techId);
        if (tech) {
          abilities.push(techniqueToAbility(tech));
        }
      }
    }

    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return abilities;
    }

    for (const techId of character.unlockedTechniques ?? []) {
      const tech = getTechnique(techId);
      if (tech && !abilities.some((entry) => entry.id === tech.id)) {
        abilities.push(techniqueToAbility(tech));
      }
    }

    if (character.combatStyle) {
      const style = getFightingStyle(character.combatStyle);
      if (style) {
        for (const techId of style.techniqueIds.slice(0, 3)) {
          const tech = getStyleTechnique(techId);
          if (tech && !abilities.some((entry) => entry.id === tech.id)) {
            abilities.push(techniqueToAbility(tech));
          }
        }
      }
    }

    return abilities;
  },

  unlockStyle(run: RunState, styleId: string): boolean {
    const style = getFightingStyle(styleId);
    if (!style) {
      return false;
    }
    if (!run.player.unlockedStyles) {
      run.player.unlockedStyles = [];
    }
    if (!run.player.unlockedStyles.includes(styleId)) {
      run.player.unlockedStyles.push(styleId);
    }
    if (!run.player.activeCombatStyle) {
      run.player.activeCombatStyle = styleId;
    }
    return true;
  },

  onCombatWin(run: RunState): void {
    const weapon = this.getEquippedWeapon(run.player);
    if (weapon) {
      this.addMastery(run, weapon.weaponType, 1);
    } else if (run.player.activeCombatStyle === "black_leg") {
      this.addMastery(run, "KICKS", 1);
    } else if (run.player.activeCombatStyle === "brawler") {
      this.addMastery(run, "FISTS", 1);
    }
  },

  randomWeaponId(): string {
    return WEAPONS[Math.floor(Math.random() * WEAPONS.length)]!.id;
  },

  /** Migrate legacy inventory weapon stacks into WeaponInstance-shaped items. */
  migrateInventoryWeapons(run: RunState): void {
    for (const item of run.player.inventory) {
      if (item.weaponDefinitionId) {
        item.type = "WEAPON";
        item.category = "WEAPONS";
        item.equipped = Boolean(item.equipped);
        continue;
      }
      const match = (item.itemId || item.id).match(/^weapon_(.+)$/);
      if (match) {
        item.weaponDefinitionId = match[1];
        item.type = "WEAPON";
        item.category = "WEAPONS";
        item.equipped = Boolean(item.equipped);
        item.ownerCharacterId = item.ownerCharacterId ?? run.player.id;
      }
    }

    const equipId = run.player.equipment?.primaryWeaponId;
    if (!equipId) {
      return;
    }
    if (this.findInstance(run.player, equipId)) {
      const inst = this.findInstance(run.player, equipId)!;
      inst.equipped = true;
      return;
    }
    // Legacy definition id on equipment
    if (getWeapon(equipId)) {
      let inst = run.player.inventory.find((item) => item.weaponDefinitionId === equipId);
      if (!inst) {
        const created = this.createWeaponInstance(equipId, run.player.id);
        if (created) {
          run.player.inventory.push(created);
          inst = created;
        }
      }
      if (inst) {
        inst.equipped = true;
        run.player.equipment!.primaryWeaponId = inst.id;
      }
    }
  },
};

export function weaponDisplayName(player: Player): string {
  const weapon = WeaponService.getEquippedWeapon(player);
  if (weapon) {
    return weapon.name;
  }
  if (player.activeCombatStyle) {
    const style = getFightingStyle(player.activeCombatStyle);
    return style?.name ?? "Unarmed";
  }
  return "Unarmed";
}

export function primaryMasteryDisplay(player: Player): { type: WeaponType; rank: MasteryRank } | null {
  const weapon = WeaponService.getEquippedWeapon(player);
  const type =
    weapon?.weaponType ??
    (player.activeCombatStyle === "black_leg"
      ? "KICKS"
      : player.activeCombatStyle === "brawler"
        ? "FISTS"
        : null);
  if (!type) {
    return null;
  }
  return {
    type,
    rank: WeaponService.getMasteryRank(player, type),
  };
}
