import { MASTERY_RANK_ORDER, MASTERY_THRESHOLDS } from "../game/constants";
import {
  BASIC_MELEE_WEAPON_TYPES,
  canEquipAsSecondary,
  equippedWeaponTypes,
  resolveWeaponGrip,
  techniqueMatchesEquipped,
  type WeaponGrip,
} from "../game/weaponClasses";
import { DUAL_WIELD_TECHNIQUES } from "../data/devilFruitCombat";
import { getTechnique, getWeapon, WEAPONS } from "../data/weapons";
import { getFightingStyle, getStyleTechnique } from "../data/fightingStyles";
import { techniqueToAbility } from "../game/techniqueAbility";
import type {
  Ability,
  GeneratedWeapon,
  InventoryItem,
  MasteryRank,
  Player,
  RunState,
  Weapon,
  WeaponType,
} from "../models/types";
import { createId } from "../utils/ids";
import { CharacterService } from "./CharacterService";
import { LootDispositionService } from "./LootDispositionService";

export type EquipSlot = "primary" | "secondary";

function isWeaponItem(item: InventoryItem): boolean {
  return item.type === "WEAPON" || Boolean(item.weaponDefinitionId) || Boolean(item.generatedWeapon);
}

/** Unified view for static catalog weapons and generated shop weapons. */
export type WeaponView = Weapon & {
  accuracy: number;
  reach: number;
  weight: number;
  scalingStat?: Weapon["scalingStat"];
  material?: GeneratedWeapon["material"];
  quality?: GeneratedWeapon["quality"];
  price?: number;
  special?: string;
  isNamed?: boolean;
  archetypeId?: string;
  category?: GeneratedWeapon["category"];
  critBonus?: number;
  grip: WeaponGrip;
};

function viewFromGenerated(generated: GeneratedWeapon, id: string): WeaponView {
  return {
    id,
    name: generated.name,
    weaponType: generated.weaponType,
    rarity: generated.rarity,
    damage: generated.damage,
    speed: generated.speed,
    traits: generated.traits,
    techniqueIds: generated.techniqueIds,
    accuracy: generated.accuracy,
    reach: generated.reach,
    weight: generated.weight,
    scalingStat: generated.scalingStat,
    material: generated.material,
    quality: generated.quality,
    price: generated.price,
    special: generated.special,
    isNamed: generated.isNamed,
    archetypeId: generated.archetypeId,
    category: generated.category,
    critBonus: generated.critBonus,
    grip: resolveWeaponGrip({
      grip: generated.grip,
      traits: generated.traits,
      archetypeId: generated.archetypeId,
    }),
  };
}

function viewFromCatalog(weapon: Weapon): WeaponView {
  return {
    ...weapon,
    accuracy: weapon.accuracy ?? 6,
    reach: weapon.reach ?? (weapon.weaponType === "SPEAR" ? 5 : weapon.weaponType === "GUN" ? 8 : 2),
    weight: weapon.weight ?? 4,
    scalingStat: weapon.scalingStat,
    grip: resolveWeaponGrip({
      grip: weapon.grip,
      traits: weapon.traits,
      archetypeId: weapon.id,
    }),
  };
}

export const WeaponService = {
  defaultEquipment(): { primaryWeaponId: string | null; secondaryWeaponId: string | null } {
    return { primaryWeaponId: null, secondaryWeaponId: null };
  },

  defaultMastery(): Partial<Record<WeaponType, number>> {
    return {};
  },

  resolveWeaponView(item: InventoryItem | null | undefined): WeaponView | undefined {
    if (!item) return undefined;
    if (item.generatedWeapon) {
      return viewFromGenerated(
        item.generatedWeapon,
        item.weaponDefinitionId ?? `gen_${item.generatedWeapon.archetypeId}`,
      );
    }
    if (item.weaponDefinitionId) {
      const weapon = getWeapon(item.weaponDefinitionId);
      return weapon ? viewFromCatalog(weapon) : undefined;
    }
    return undefined;
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

  createGeneratedInstance(generated: GeneratedWeapon, ownerCharacterId: string | null = null): InventoryItem {
    const definitionId = generated.namedId
      ? `named_${generated.namedId}`
      : `gen_${generated.archetypeId}_${generated.material}_${generated.quality}`;
    return {
      id: createId("wpn"),
      itemId: `weapon_${definitionId}`,
      name: generated.name,
      type: "WEAPON",
      description: generated.special
        ?? `${generated.quality} ${generated.material} ${generated.archetypeId} (${generated.rarity}).`,
      quantity: 1,
      weaponDefinitionId: definitionId,
      generatedWeapon: generated,
      ownerCharacterId,
      equipped: false,
      category: "WEAPONS",
    };
  },

  /**
   * Grant a generated weapon into inventory only — never auto-equips.
   * Returns the new instance id.
   */
  grantGeneratedWeapon(
    run: RunState,
    generated: GeneratedWeapon,
    options?: { autoEquip?: boolean; ownerCharacterId?: string | null; skipDisposition?: boolean },
  ): string | null {
    const instance = this.createGeneratedInstance(generated, options?.ownerCharacterId ?? run.player.id);
    instance.equipped = false;
    run.player.inventory.push(instance);
    if (options?.autoEquip === true) {
      this.equipInstance(run, instance.id, run.player.id);
    } else if (!options?.skipDisposition) {
      LootDispositionService.queue(run, {
        kind: "weapon",
        instanceId: instance.id,
        label: generated.name,
      });
    }
    return instance.id;
  },

  listOwnedWeapons(player: Player): InventoryItem[] {
    return player.inventory.filter(isWeaponItem);
  },

  /** Shop list price — generated weapons use rolled price; catalog uses a damage-based estimate. */
  estimateListPrice(weapon: WeaponView): number {
    if (weapon.price != null && weapon.price > 0) {
      return weapon.price;
    }
    const rarityPad: Record<string, number> = {
      COMMON: 0,
      UNCOMMON: 40,
      RARE: 120,
      EPIC: 280,
      LEGENDARY: 500,
    };
    return Math.max(20, weapon.damage * 14 + weapon.speed * 6 + (rarityPad[weapon.rarity] ?? 0));
  },

  /** Merchants buy back at half list price. */
  sellValue(weapon: WeaponView): number {
    return Math.max(1, Math.floor(this.estimateListPrice(weapon) * 0.5));
  },

  removeWeaponInstance(run: RunState, instanceId: string): InventoryItem | null {
    const instance = this.findInstance(run.player, instanceId);
    if (!instance) {
      return null;
    }
    if (instance.equipped) {
      this.unequipInstance(run, instanceId);
    }
    const ownerId = instance.ownerCharacterId;
    if (ownerId && ownerId !== run.player.id) {
      const character = CharacterService.getCharacter(run, ownerId);
      if (character?.weaponIds?.length) {
        character.weaponIds = character.weaponIds.filter((id) => id !== instance.weaponDefinitionId);
      }
    }
    run.player.inventory = run.player.inventory.filter((item) => item.id !== instanceId);
    return instance;
  },

  sellWeapon(run: RunState, instanceId: string): { ok: boolean; reason: string; berries?: number } {
    const instance = this.findInstance(run.player, instanceId);
    if (!instance) {
      return { ok: false, reason: "That weapon is not in your pack." };
    }
    const view = this.resolveWeaponView(instance);
    if (!view) {
      return { ok: false, reason: "Unknown weapon." };
    }
    const value = this.sellValue(view);
    if (!this.removeWeaponInstance(run, instanceId)) {
      return { ok: false, reason: "Could not remove that weapon." };
    }
    run.player.berries += value;
    return { ok: true, reason: `Sold ${view.name} for ฿${value}.`, berries: value };
  },

  findInstance(player: Player, instanceId: string): InventoryItem | undefined {
    return player.inventory.find((item) => item.id === instanceId && isWeaponItem(item));
  },

  findEquippedInstance(player: Player, slot: EquipSlot = "primary"): InventoryItem | undefined {
    const equipId =
      slot === "primary" ? player.equipment?.primaryWeaponId : player.equipment?.secondaryWeaponId;
    if (equipId) {
      const byId = this.findInstance(player, equipId);
      if (byId) {
        return byId;
      }
      if (slot === "primary") {
        // Legacy: equipment stored definition id
        return player.inventory.find(
          (item) =>
            isWeaponItem(item) &&
            (item.weaponDefinitionId === equipId || item.itemId === `weapon_${equipId}` || item.equipped),
        );
      }
    }
    if (slot === "primary") {
      return player.inventory.find((item) => isWeaponItem(item) && item.equipped);
    }
    return undefined;
  },

  findEquippedInstances(player: Player): InventoryItem[] {
    const primary = this.findEquippedInstance(player, "primary");
    const secondary = this.findEquippedInstance(player, "secondary");
    const list: InventoryItem[] = [];
    if (primary) list.push(primary);
    if (secondary && secondary.id !== primary?.id) list.push(secondary);
    return list;
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

  /** Equip by inventory instance id. Previous weapon in that slot returns unequipped to backpack. */
  equipInstance(
    run: RunState,
    instanceId: string,
    ownerCharacterId: string = run.player.id,
    slot: EquipSlot = "primary",
  ): boolean {
    const instance = this.findInstance(run.player, instanceId);
    if (!instance || (!instance.weaponDefinitionId && !instance.generatedWeapon)) {
      return false;
    }
    if (!run.player.equipment) {
      run.player.equipment = this.defaultEquipment();
    }

    const view = this.resolveWeaponView(instance);
    if (!view) {
      return false;
    }

    // Crew / non-player owners still use a single equipped weapon.
    if (ownerCharacterId !== run.player.id) {
      for (const item of run.player.inventory) {
        if (
          isWeaponItem(item) &&
          item.equipped &&
          item.ownerCharacterId === ownerCharacterId &&
          item.id !== instanceId
        ) {
          item.equipped = false;
          item.ownerCharacterId = run.player.id;
        }
      }
      instance.equipped = true;
      instance.ownerCharacterId = ownerCharacterId;
      return true;
    }

    if (slot === "secondary") {
      const primary = this.getEquippedWeapon(run.player, "primary");
      const check = canEquipAsSecondary(primary, view);
      if (!check.ok) {
        run.lastFeedback = check.reason;
        return false;
      }
    }

    // Clear this instance from the other slot if it was already equipped there.
    if (run.player.equipment.primaryWeaponId === instanceId && slot === "secondary") {
      run.player.equipment.primaryWeaponId = null;
    }
    if (run.player.equipment.secondaryWeaponId === instanceId && slot === "primary") {
      run.player.equipment.secondaryWeaponId = null;
    }

    const previousId =
      slot === "primary" ? run.player.equipment.primaryWeaponId : run.player.equipment.secondaryWeaponId;
    if (previousId && previousId !== instanceId) {
      const previous = this.findInstance(run.player, previousId);
      if (previous) {
        previous.equipped = false;
        previous.ownerCharacterId = run.player.id;
      }
    }

    // Two-hand primary clears secondary.
    if (slot === "primary" && view.grip === "TWO_HAND") {
      const secondaryId = run.player.equipment.secondaryWeaponId;
      if (secondaryId) {
        const secondary = this.findInstance(run.player, secondaryId);
        if (secondary) {
          secondary.equipped = false;
          secondary.ownerCharacterId = run.player.id;
        }
        run.player.equipment.secondaryWeaponId = null;
      }
    }

    instance.equipped = true;
    instance.ownerCharacterId = ownerCharacterId;
    if (slot === "primary") {
      run.player.equipment.primaryWeaponId = instance.id;
    } else {
      run.player.equipment.secondaryWeaponId = instance.id;
    }
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
    if (run.player.equipment?.secondaryWeaponId === instanceId) {
      run.player.equipment.secondaryWeaponId = null;
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
    if (!instance?.weaponDefinitionId && !instance?.generatedWeapon) {
      return { ok: false, reason: "That weapon is not in your pack." };
    }
    const weapon = this.resolveWeaponView(instance);
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
    character.weaponIds = [instance.weaponDefinitionId ?? weapon.id];
    return { ok: true, reason: `${character.name} now carries the ${weapon.name}.` };
  },

  equippedInstanceFor(run: RunState, characterId: string): InventoryItem | undefined {
    const owned = run.player.inventory.find(
      (item) =>
        isWeaponItem(item) &&
        item.equipped &&
        (item.ownerCharacterId ?? run.player.id) === characterId,
    );
    if (owned) {
      return owned;
    }
    // Legacy / spawn loadout: weaponIds on the character without an inventory link.
    const character = CharacterService.getCharacter(run, characterId);
    const definitionId = character?.weaponIds?.[0];
    if (!definitionId) {
      return undefined;
    }
    return run.player.inventory.find(
      (item) =>
        isWeaponItem(item) &&
        item.weaponDefinitionId === definitionId &&
        (item.ownerCharacterId === characterId || !item.ownerCharacterId || item.ownerCharacterId === run.player.id),
    );
  },

  /** Resolve equipped weapon view for a crewmate (inventory first, then catalog weaponIds). */
  getEquippedWeaponForCharacter(run: RunState, characterId: string): WeaponView | undefined {
    const instance = this.equippedInstanceFor(run, characterId);
    const fromInstance = this.resolveWeaponView(instance);
    if (fromInstance) {
      return fromInstance;
    }
    const character = CharacterService.getCharacter(run, characterId);
    const definitionId = character?.weaponIds?.[0];
    if (!definitionId) {
      return undefined;
    }
    const catalog = getWeapon(definitionId);
    return catalog ? viewFromCatalog(catalog) : undefined;
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
    if ((!instance?.weaponDefinitionId && !instance?.generatedWeapon) || !character) {
      return { ok: false, reason: "Cannot assign that." };
    }
    const weapon = this.resolveWeaponView(instance);
    if (!weapon) {
      return { ok: false, reason: "Unknown weapon." };
    }
    const role = run.crew.find((member) => member.characterId === characterId)?.role;
    if (role === "SNIPER" && weapon.weaponType !== "GUN") {
      return {
        ok: false,
        reason: `${character.name} cannot equip ${weapon.weaponType === "SPEAR" ? "Spears" : `${weapon.weaponType.toLowerCase()}s`} as a sniper.`,
      };
    }
    if (role === "SWORDSMAN" && weapon.weaponType !== "SWORD") {
      return { ok: false, reason: `${character.name} cannot equip ${weapon.name} — swordsmen use blades.` };
    }
    return { ok: true, reason: "" };
  },

  getEquippedWeaponId(player: Player, slot: EquipSlot = "primary"): string | null {
    const instance = this.findEquippedInstance(player, slot);
    if (instance?.weaponDefinitionId) {
      return instance.weaponDefinitionId;
    }
    const raw =
      slot === "primary"
        ? (player.equipment?.primaryWeaponId ?? null)
        : (player.equipment?.secondaryWeaponId ?? null);
    if (raw && getWeapon(raw)) {
      return raw;
    }
    return null;
  },

  getEquippedWeapon(player: Player, slot: EquipSlot = "primary"): WeaponView | undefined {
    const instance = this.findEquippedInstance(player, slot);
    const fromInstance = this.resolveWeaponView(instance);
    if (fromInstance) {
      return fromInstance;
    }
    const id = this.getEquippedWeaponId(player, slot);
    const weapon = id ? getWeapon(id) : undefined;
    return weapon ? viewFromCatalog(weapon) : undefined;
  },

  getEquippedWeapons(player: Player): WeaponView[] {
    return this.findEquippedInstances(player)
      .map((item) => this.resolveWeaponView(item))
      .filter((weapon): weapon is WeaponView => Boolean(weapon));
  },

  /** Weapon classes currently in hand (primary + secondary). */
  equippedTypesForPlayer(player: Player): WeaponType[] {
    const types = equippedWeaponTypes(this.getEquippedWeapons(player));
    if (types.length === 0) {
      if (player.activeCombatStyle === "black_leg") return ["KICKS"];
      if (player.activeCombatStyle === "brawler") return ["FISTS"];
    }
    return types;
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
    const equippedTypes = this.equippedTypesForPlayer(player);
    const pushTech = (tech: ReturnType<typeof getTechnique>) => {
      if (!tech || abilities.some((entry) => entry.id === tech.id)) {
        return;
      }
      if (!techniqueMatchesEquipped(tech, equippedTypes)) {
        return;
      }
      abilities.push(techniqueToAbility(tech));
    };

    for (const weapon of this.getEquippedWeapons(player)) {
      for (const techId of weapon.techniqueIds) {
        pushTech(getTechnique(techId));
      }
    }

    for (const techId of player.unlockedTechniques ?? []) {
      pushTech(getTechnique(techId));
    }

    const styleId = player.activeCombatStyle;
    if (styleId) {
      const style = getFightingStyle(styleId);
      if (style) {
        for (const techId of style.techniqueIds.slice(0, 3)) {
          pushTech(getStyleTechnique(techId));
        }
      }
    }

    // Dual-wield combo skills when both required classes are in hand.
    for (const dual of DUAL_WIELD_TECHNIQUES) {
      if (abilities.some((entry) => entry.id === dual.id)) continue;
      if (!dual.requiredWeaponTypes.every((type) => equippedTypes.includes(type))) continue;
      abilities.push({
        id: dual.id,
        name: dual.name,
        description: dual.description,
        power: dual.power,
        powerLevel: dual.powerLevel,
        scalingStat: dual.scalingStat,
        accuracyMod: dual.accuracyMod,
        mpCost: dual.mpCost,
        tags: dual.tags,
        requiredWeaponTypes: [...dual.requiredWeaponTypes],
      });
    }

    return abilities;
  },

  techniquesForCharacter(run: RunState, characterId: string): Ability[] {
    const abilities: Ability[] = [];
    const weapon = this.getEquippedWeaponForCharacter(run, characterId);
    const equippedTypes = weapon ? [weapon.weaponType] : [];
    const pushTech = (tech: ReturnType<typeof getTechnique>) => {
      if (!tech || abilities.some((entry) => entry.id === tech.id)) {
        return;
      }
      if (!techniqueMatchesEquipped(tech, equippedTypes)) {
        return;
      }
      abilities.push(techniqueToAbility(tech));
    };

    if (weapon) {
      for (const techId of weapon.techniqueIds) {
        pushTech(getTechnique(techId));
      }
    }

    const character = CharacterService.getCharacter(run, characterId);
    if (!character) {
      return abilities;
    }

    for (const techId of character.unlockedTechniques ?? []) {
      pushTech(getTechnique(techId));
    }

    if (character.combatStyle) {
      const style = getFightingStyle(character.combatStyle);
      if (style) {
        for (const techId of style.techniqueIds.slice(0, 3)) {
          pushTech(getStyleTechnique(techId));
        }
      }
    }

    return abilities;
  },

  /** Whether Focused Strike should appear given current weapons. */
  canUseBasicMelee(player: Player): boolean {
    return this.canUseBasicMeleeWithTypes(this.equippedTypesForPlayer(player));
  },

  canUseBasicMeleeForCharacter(run: RunState, characterId: string): boolean {
    const weapon = this.getEquippedWeaponForCharacter(run, characterId);
    const types = weapon ? [weapon.weaponType] : [];
    return this.canUseBasicMeleeWithTypes(types);
  },

  canUseBasicMeleeWithTypes(types: WeaponType[]): boolean {
    if (types.length === 0) {
      return true; // unarmed
    }
    return types.some((type) => BASIC_MELEE_WEAPON_TYPES.includes(type));
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
    const weapons = this.getEquippedWeapons(run.player);
    if (weapons.length) {
      for (const weapon of weapons) {
        this.addMastery(run, weapon.weaponType, 1);
      }
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
  const weapons = WeaponService.getEquippedWeapons(player);
  if (weapons.length === 2) {
    return `${weapons[0]!.name} + ${weapons[1]!.name}`;
  }
  if (weapons[0]) {
    return weapons[0].name;
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
