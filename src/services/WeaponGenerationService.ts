import { getArchetype, NAMED_WEAPON_TEMPLATES, WEAPON_ARCHETYPES, type WeaponArchetype } from "../data/weaponArchetypes";
import { gripFromTags } from "../game/weaponClasses";
import type {
  GeneratedWeapon,
  Player,
  WeaponMaterial,
  WeaponQuality,
  WeaponRarity,
  WeaponType,
} from "../models/types";
import type { RandomService } from "./RandomService";

const MATERIAL_MODS: Record<
  WeaponMaterial,
  { label: string; dmg: number; spd: number; acc: number; weight: number; price: number; rarityBump: number }
> = {
  WOOD: { label: "Wooden", dmg: -1, spd: 1, acc: 0, weight: -1, price: 0.55, rarityBump: 0 },
  SCRAP: { label: "Scrap", dmg: 0, spd: 0, acc: -1, weight: 0, price: 0.45, rarityBump: 0 },
  BONE: { label: "Bone", dmg: 0, spd: 1, acc: 0, weight: -1, price: 0.7, rarityBump: 0 },
  BRONZE: { label: "Bronze", dmg: 0, spd: 0, acc: 0, weight: 0, price: 0.85, rarityBump: 0 },
  IRON: { label: "Iron", dmg: 1, spd: 0, acc: 0, weight: 1, price: 1, rarityBump: 0 },
  STEEL: { label: "Steel", dmg: 2, spd: 0, acc: 1, weight: 0, price: 1.45, rarityBump: 1 },
  IVORY: { label: "Ivory", dmg: 1, spd: 1, acc: 1, weight: -1, price: 1.8, rarityBump: 1 },
  OBSIDIAN: { label: "Obsidian", dmg: 2, spd: 1, acc: 0, weight: -1, price: 2.1, rarityBump: 2 },
  SEA_STONE_ALLOY: { label: "Sea-Stone", dmg: 3, spd: -1, acc: 1, weight: 2, price: 3.2, rarityBump: 2 },
};

const QUALITY_MODS: Record<
  WeaponQuality,
  { label: string; dmg: number; spd: number; acc: number; crit: number; price: number; rarityBump: number }
> = {
  RUSTY: { label: "Rusty", dmg: -2, spd: 0, acc: -1, crit: 0, price: 0.45, rarityBump: 0 },
  WORN: { label: "Worn", dmg: -1, spd: 0, acc: 0, crit: 0, price: 0.7, rarityBump: 0 },
  STANDARD: { label: "", dmg: 0, spd: 0, acc: 0, crit: 0, price: 1, rarityBump: 0 },
  FINE: { label: "Fine", dmg: 1, spd: 1, acc: 1, crit: 1, price: 1.55, rarityBump: 1 },
  MASTERWORK: { label: "Masterwork", dmg: 2, spd: 1, acc: 2, crit: 2, price: 2.4, rarityBump: 2 },
  LEGENDARY_CRAFT: { label: "Peerless", dmg: 3, spd: 2, acc: 2, crit: 3, price: 3.8, rarityBump: 3 },
};

const RARITY_ORDER: WeaponRarity[] = ["COMMON", "UNCOMMON", "RARE", "LEGENDARY"];

function clampStat(value: number, min = 1, max = 20): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function rarityFromBump(bump: number): WeaponRarity {
  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, bump))]!;
}

function buildName(archetype: WeaponArchetype, material: WeaponMaterial, quality: WeaponQuality): string {
  const mat = MATERIAL_MODS[material].label;
  const qual = QUALITY_MODS[quality].label;
  if (quality === "RUSTY") {
    return `Rusty ${archetype.name}`;
  }
  if (quality === "WORN") {
    return `Worn ${mat} ${archetype.name}`;
  }
  if (qual) {
    return `${qual} ${mat} ${archetype.name}`;
  }
  return `${mat} ${archetype.name}`;
}

function traitsFor(
  archetype: WeaponArchetype,
  material: WeaponMaterial,
  quality: WeaponQuality,
): string[] {
  const traits = new Set<string>([...archetype.tags]);
  if (material === "SCRAP" || material === "WOOD") traits.add("cheap");
  if (material === "STEEL" || material === "IVORY") traits.add("reliable");
  if (quality === "RUSTY") traits.add("rusty");
  if (quality === "FINE" || quality === "MASTERWORK") traits.add("crafted");
  if (archetype.baseReach >= 5) traits.add("reach");
  if (archetype.baseSpeed >= 8) traits.add("quick");
  if (archetype.baseDamage >= 11) traits.add("heavy_impact");
  return [...traits];
}

export type GenerateWeaponOptions = {
  archetype?: WeaponArchetype;
  archetypeId?: string;
  material?: WeaponMaterial;
  quality?: WeaponQuality;
  forceNamed?: boolean;
  namedId?: string;
  priceMultiplier?: number;
};

export const WeaponGenerationService = {
  materials(): WeaponMaterial[] {
    return Object.keys(MATERIAL_MODS) as WeaponMaterial[];
  },

  qualities(): WeaponQuality[] {
    return Object.keys(QUALITY_MODS) as WeaponQuality[];
  },

  pickMaterial(rng: RandomService, pool?: WeaponMaterial[]): WeaponMaterial {
    const list = pool?.length ? pool : (Object.keys(MATERIAL_MODS) as WeaponMaterial[]);
    const weighted = list.map((material) => ({
      material,
      weight:
        material === "WOOD" || material === "IRON" || material === "SCRAP"
          ? 8
          : material === "STEEL" || material === "BRONZE"
            ? 5
            : material === "BONE" || material === "IVORY"
              ? 2
              : 1,
    }));
    return rng.pickWeighted(weighted).material;
  },

  pickQuality(rng: RandomService, pool?: WeaponQuality[]): WeaponQuality {
    const list = pool?.length ? pool : (Object.keys(QUALITY_MODS) as WeaponQuality[]);
    const weighted = list.map((quality) => ({
      quality,
      weight:
        quality === "STANDARD"
          ? 10
          : quality === "WORN"
            ? 6
            : quality === "RUSTY"
              ? 4
              : quality === "FINE"
                ? 3
                : quality === "MASTERWORK"
                  ? 1
                  : 0.25,
    }));
    return rng.pickWeighted(weighted).quality;
  },

  generate(rng: RandomService, options: GenerateWeaponOptions = {}): GeneratedWeapon {
    if (options.forceNamed || options.namedId) {
      return this.generateNamed(rng, options.namedId);
    }

    const archetype =
      options.archetype ??
      (options.archetypeId ? getArchetype(options.archetypeId) : undefined) ??
      rng.pick(WEAPON_ARCHETYPES);
    const material = options.material ?? this.pickMaterial(rng);
    const quality = options.quality ?? this.pickQuality(rng);
    const mat = MATERIAL_MODS[material];
    const qual = QUALITY_MODS[quality];

    const damage = clampStat(archetype.baseDamage + mat.dmg + qual.dmg);
    const speed = clampStat(archetype.baseSpeed + mat.spd + qual.spd);
    const accuracy = clampStat(archetype.baseAccuracy + mat.acc + qual.acc);
    const reach = clampStat(archetype.baseReach, 1, 14);
    const weight = clampStat(archetype.baseWeight + mat.weight, 1, 14);
    const rarity = rarityFromBump(mat.rarityBump + qual.rarityBump);
    const price = Math.max(
      15,
      Math.round(archetype.priceBase * mat.price * qual.price * (options.priceMultiplier ?? 1)),
    );

    return {
      archetypeId: archetype.id,
      material,
      quality,
      name: buildName(archetype, material, quality),
      weaponType: archetype.weaponType,
      category: archetype.category,
      rarity,
      damage,
      speed,
      accuracy,
      reach,
      weight,
      critBonus: qual.crit,
      scalingStat: archetype.scalingStat,
      traits: traitsFor(archetype, material, quality),
      techniqueIds: [...archetype.techniqueIds],
      price,
      grip: gripFromTags(archetype.tags, archetype.id),
    };
  },

  generateNamed(rng: RandomService, namedId?: string): GeneratedWeapon {
    const template = namedId
      ? NAMED_WEAPON_TEMPLATES.find((entry) => entry.id === namedId) ?? rng.pick(NAMED_WEAPON_TEMPLATES)
      : rng.pick(NAMED_WEAPON_TEMPLATES);
    const archetype = getArchetype(template.archetypeId) ?? WEAPON_ARCHETYPES[0]!;
    const material: WeaponMaterial = template.rarity === "LEGENDARY" ? "SEA_STONE_ALLOY" : "STEEL";
    const quality: WeaponQuality = template.rarity === "LEGENDARY" ? "LEGENDARY_CRAFT" : "FINE";
    const base = this.generate(rng, { archetype, material, quality });
    return {
      ...base,
      name: template.name,
      rarity: template.rarity,
      damage: clampStat(base.damage + template.damageBonus),
      speed: clampStat(base.speed + template.speedBonus),
      accuracy: clampStat(base.accuracy + template.accuracyBonus),
      price: base.price + template.priceBonus,
      traits: [...new Set([...base.traits, ...template.traits])],
      special: template.special,
      isNamed: true,
      namedId: template.id,
    };
  },

  repetitionKey(weapon: GeneratedWeapon): string {
    if (weapon.isNamed && weapon.namedId) {
      return `named:${weapon.namedId}`;
    }
    return `${weapon.archetypeId}:${weapon.material}:${weapon.quality}`;
  },

  /** Soft preference for the player's equipped weapon family without locking the shop. */
  preferredWeaponTypes(player: Player | null | undefined): WeaponType[] {
    const mastery = player?.weaponMastery ?? {};
    const ranked = (Object.entries(mastery) as Array<[WeaponType, number]>)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
    return ranked.slice(0, 2);
  },
};
