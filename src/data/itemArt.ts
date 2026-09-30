import type { FruitType, InventoryItem, InventorySubtype, WeaponType } from "../models/types";
import { getDevilFruit } from "./devilFruits";
import { classifyInventoryItem } from "./inventoryTaxonomy";
import { getItemDefinition } from "./items";
import { getWeapon } from "./weapons";

const ROOT = "/icons/Items";

/** Explicit portraits from `public/icons/Items`. */
export const ITEM_ART_BY_ID: Record<string, string> = {
  spoiled_biscuit: `${ROOT}/Food/SpoiledBiscuit.png`,
  rice_ball: `${ROOT}/Food/Riceball.png`,
  dried_meat: `${ROOT}/Food/DriedMeat.png`,
  travel_rations: `${ROOT}/Food/FruitBundle.png`,
  cooked_fish: `${ROOT}/Food/CookedFish.png`,
  hearty_meal: `${ROOT}/Food/HeartyMeal.png`,
  captains_feast: `${ROOT}/Food/CaptainsFeast.png`,
  island_apple: `${ROOT}/Food/Fruits.png`,
  island_mango: `${ROOT}/Food/Fruits.png`,
  wild_banana: `${ROOT}/Food/Fruits.png`,
  fish: `${ROOT}/Food/RawFish.png`,
  fish_fine: `${ROOT}/Food/RawFish.png`,
  fish_prime: `${ROOT}/Food/RawFish.png`,
  fish_golden: `${ROOT}/Food/RawFish.png`,
  sea_king_meat: `${ROOT}/Food/RawMeat.png`,
  brackish_dregs: `${ROOT}/Drinks/BrackishDregs.png`,
  fresh_water: `${ROOT}/Drinks/Water.png`,
  grog: `${ROOT}/Drinks/Grog.png`,
  citrus_juice: `${ROOT}/Drinks/CitrusJuice.png`,
  energy_tonic: `${ROOT}/Drinks/EnergyTonic.png`,
  strong_brew: `${ROOT}/Drinks/Rum.png`,
  dirty_rag: `${ROOT}/Medicine/DirtyRag.png`,
  bandage: `${ROOT}/Medicine/Bandage.png`,
  medicine: `${ROOT}/Medicine/BasicMedicine.png`,
  medical_kit: `${ROOT}/Medicine/MedicalKit.png`,
  strong_medicine: `${ROOT}/Medicine/StrongMedicine.png`,
  miracle_salve: `${ROOT}/Medicine/MiracleSalve.png`,
  phoenix_tear: `${ROOT}/Medicine/PhoenixTear.png`,
  antidote: `${ROOT}/Medicine/Antidote.png`,
  burn_salve: `${ROOT}/Medicine/BurnSalve.png`,
  stitch_kit: `${ROOT}/Medicine/StitchKit.png`,
  eye_wash: `${ROOT}/Medicine/EyeWash.png`,
  smelling_salts: `${ROOT}/Medicine/SmellingSalts.png`,
  calming_tonic: `${ROOT}/Medicine/CalmingTonic.png`,
  anti_nausea: `${ROOT}/Medicine/AntiNausea.png`,
  status_remover_kit: `${ROOT}/Medicine/StatusRemoverKit.png`,
  smoke_bomb: `${ROOT}/Utility/SmokeBomb.png`,
  east_blue_chart: `${ROOT}/Maps/AncientChart.png`,
  rusty_cutlass: `${ROOT}/Weapons/Sword/Cutlass1.png`,
  marine_breastplate: `${ROOT}/Quest/HeroesBreastplate.png`,
  fishman_scale: `${ROOT}/Materials/SeaKingScale.png`,
  sky_island_fragment: `${ROOT}/Collectables/Minerals.png`,
  forbidden_folio: `${ROOT}/Contraband/ForbiddenBook.png`,
  ancient_gear_diagram: `${ROOT}/Knowledge/AncientSketches.png`,
  marine_field_manual: `${ROOT}/Manuals/MeleeTechnique.png`,
  ancient_navigation_journal: `${ROOT}/Manuals/Navigation.png`,
  wanted_poster_scrap: `${ROOT}/Collectables/OldWantedPoster.png`,
  coral_charm: `${ROOT}/Collectables/RareShells.png`,
  old_bounty_ledger: `${ROOT}/Knowledge/SmugglerLedger.png`,
  fruitbound_remnant: `${ROOT}/Devil Fruits/Paramecia.png`,
  hardwood: `${ROOT}/Materials/HardWood.png`,
  fiber: `${ROOT}/Materials/Cloth.png`,
  stone: `${ROOT}/Collectables/Minerals.png`,
  copper_ore: `${ROOT}/Trade Goods/GoldOre.png`,
  iron_ore: `${ROOT}/Materials/Iron.png`,
  resin: `${ROOT}/Materials/StrangeAlloy.png`,
  clay: `${ROOT}/Materials/Leather.png`,
  coal: `${ROOT}/Materials/MetalScrap.png`,
  salt: `${ROOT}/Trade Goods/Spices.png`,
  medicinal_herb: `${ROOT}/Books/Medicine.png`,
  rare_mushroom: `${ROOT}/Food/FruitBundle.png`,
  seeds: `${ROOT}/Trade Goods/ExoticFruit.png`,
  biological_material: `${ROOT}/Contraband/RareBioMaterial.png`,
  sulfur: `${ROOT}/Materials/StrangeAlloy.png`,
  obsidian_shard: `${ROOT}/Treasure/PreciousStone.png`,
  reeds: `${ROOT}/Materials/Wood.png`,
  rope_scrap: `${ROOT}/Materials/Rope.png`,
  abandoned_backpack: `${ROOT}/Quest/MysteriousPackage.png`,
  washed_up_crate: `${ROOT}/Trade Goods/FoodCrate.png`,
  buried_box: `${ROOT}/Treasure/BronzeChest.png`,
  torn_document: `${ROOT}/Knowledge/ResearchNotes.png`,
  herbalist_kit: `${ROOT}/Tools/CookingKit.png`,
  prospecting_kit: `${ROOT}/Exploration Gear/Pickaxe.png`,
  foraging_basket: `${ROOT}/Exploration Gear/Shovel.png`,
  field_knife: `${ROOT}/Weapons/Cooking/Knife.png`,
  scavenging_tools: `${ROOT}/Tools/ExcavationKit.png`,
  investigation_kit: `${ROOT}/Tools/InfiltrationKit.png`,
};

const SUBTYPE_FALLBACK: Partial<Record<InventorySubtype, string>> = {
  FOOD: `${ROOT}/Food/RiceMeal.png`,
  DRINK: `${ROOT}/Drinks/Water.png`,
  HEALING_MEDICINE: `${ROOT}/Medicine/BasicMedicine.png`,
  STATUS_MEDICINE: `${ROOT}/Medicine/Antidote.png`,
  UTILITY: `${ROOT}/Utility/SmokeBomb.png`,
  EXPLORATION: `${ROOT}/Exploration Gear/Spyglass.png`,
  TOOLS: `${ROOT}/Tools/RepairKit.png`,
  TRAINING: `${ROOT}/Training Equipment/TrainingDummy.png`,
  BOOK: `${ROOT}/Books/History.png`,
  MANUAL: `${ROOT}/Manuals/Survival.png`,
  DOCUMENT: `${ROOT}/Knowledge/ResearchNotes.png`,
  INTEL: `${ROOT}/Information/InformantReport.png`,
  IDENTITY: `${ROOT}/FakeIdentity Items/ForgedPapers.png`,
  QUEST: `${ROOT}/Quest/StrangeToken.png`,
  TREASURE_MAP: `${ROOT}/Maps/CompleteTreasureMap.png`,
  STORY: `${ROOT}/Quest/CaptainsLog.png`,
  TREASURE: `${ROOT}/Treasure/GoldCoins.png`,
  COLLECTABLE: `${ROOT}/Collectables/HistoricalArtifact.png`,
  TRADE_GOODS: `${ROOT}/Trade Goods/LuxuryGoods1.png`,
  CONTRABAND: `${ROOT}/Contraband/IllegalCargo.png`,
  DEVIL_FRUIT: `${ROOT}/Devil Fruits/Paramecia.png`,
  MATERIAL: `${ROOT}/Materials/Wood.png`,
  SHIP_SUPPLY: `${ROOT}/Ship Supplies/SpareRope.png`,
  SHIP_COMPONENT: `${ROOT}/Ship Upgrades/RudderParts.png`,
  SWORD: `${ROOT}/Weapons/Sword/Cutlass1.png`,
  BLUNT: `${ROOT}/Weapons/Blunt/Club.png`,
  AXE: `${ROOT}/Weapons/Axe/HandAxe.png`,
  POLEARM: `${ROOT}/Weapons/Polearm/Spear1_2H.png`,
  FIREARM: `${ROOT}/Weapons/Ranged/Pistol.png`,
  HEAVY_RANGED: `${ROOT}/Weapons/Heavy Ranged/Bazooka_2H.png`,
  THROWING: `${ROOT}/Weapons/Throwing/ThrowingKnives1.png`,
  FLEXIBLE: `${ROOT}/Weapons/Flexible/Whip.png`,
  DEFENSIVE: `${ROOT}/Weapons/Shield/Shield.png`,
  SPECIAL: `${ROOT}/Weapons/Special/SpecialSword1.png`,
  IMPROVISED: `${ROOT}/Weapons/Improvised/Crowbar.png`,
  MUSICAL: `${ROOT}/Weapons/Musical/Lute_2H.png`,
  TECH: `${ROOT}/Weapons/Tech/Gauntlet.png`,
  MEDICAL: `${ROOT}/Weapons/Medical/Scalpel.png`,
  GIANT: `${ROOT}/Weapons/Giant/Sword.png`,
  TONTATTA: `${ROOT}/Weapons/Dwarf/NeedleSword.png`,
};

export const WEAPON_TYPE_ART: Record<WeaponType, string> = {
  SWORD: `${ROOT}/Weapons/Sword/Cutlass1.png`,
  SPEAR: `${ROOT}/Weapons/Polearm/Spear1_2H.png`,
  CLUB: `${ROOT}/Weapons/Blunt/Club.png`,
  GUN: `${ROOT}/Weapons/Ranged/Pistol.png`,
  FISTS: `${ROOT}/Weapons/Blunt/BrassKnuckles.png`,
  KICKS: `${ROOT}/Weapons/Improvised/Oar.png`,
};

export function devilFruitIconSrc(type?: FruitType | null): string {
  if (type === "LOGIA") {
    return `${ROOT}/Devil Fruits/Logia.png`;
  }
  if (type === "ZOAN") {
    return `${ROOT}/Devil Fruits/Zoan.png`;
  }
  return `${ROOT}/Devil Fruits/Paramecia.png`;
}

export function weaponTypeIconSrc(weaponType?: WeaponType | null): string {
  if (!weaponType) {
    return WEAPON_TYPE_ART.FISTS;
  }
  return WEAPON_TYPE_ART[weaponType];
}

export function itemIconSrc(itemId: string): string {
  if (ITEM_ART_BY_ID[itemId]) {
    return ITEM_ART_BY_ID[itemId];
  }
  const def = getItemDefinition(itemId);
  if (def) {
    const classified = classifyInventoryItem({
      id: def.id,
      itemId: def.id,
      name: def.name,
      type: def.type,
      description: def.description,
      category: def.category,
      subtype: def.subtype,
    });
    if (classified.subtype && SUBTYPE_FALLBACK[classified.subtype]) {
      return SUBTYPE_FALLBACK[classified.subtype]!;
    }
  }
  return `${ROOT}/Treasure/BronzeCoins.png`;
}

export function inventoryItemIconSrc(item: InventoryItem): string {
  if (item.type === "DEVIL_FRUIT" || item.fruitId) {
    return devilFruitIconSrc(item.fruitId ? getDevilFruit(item.fruitId)?.type : undefined);
  }
  if (item.type === "WEAPON" || item.weaponDefinitionId || item.generatedWeapon) {
    const catalogType = item.weaponDefinitionId ? getWeapon(item.weaponDefinitionId)?.weaponType : undefined;
    return weaponTypeIconSrc(item.generatedWeapon?.weaponType ?? catalogType);
  }
  return itemIconSrc(item.itemId || item.id);
}
