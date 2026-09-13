import { WEAPON_ARCHETYPES, type WeaponArchetype } from "../data/weaponArchetypes";
import type {
  GeneratedWeapon,
  Island,
  IslandArchetype,
  RunState,
  WeaponCategory,
  WeaponMaterial,
  WeaponQuality,
  WeaponShopListing,
  WeaponShopStock,
  WeaponShopTheme,
} from "../models/types";
import { createId } from "../utils/ids";
import type { RandomService } from "./RandomService";
import { IslandService } from "./IslandService";
import { WeaponGenerationService } from "./WeaponGenerationService";
import { WeaponService } from "./WeaponService";

const STOCK_REFRESH_DAYS = 3;
const HISTORY_LIMIT = 36;

const THEME_META: Record<
  WeaponShopTheme,
  { shopName: string; proprietors: string[]; flavors: string[]; categories: WeaponCategory[]; size: [number, number] }
> = {
  GENERAL: {
    shopName: "General Weapon Shop",
    proprietors: ["Old Haro", "Miss Quill", "Dockside Ken"],
    flavors: ["\"If it cuts, clubs, or cracks — I've got something.\""],
    categories: ["BLADE", "POLEARM", "BLUNT", "RANGED", "UNUSUAL"],
    size: [5, 8],
  },
  BLADE_SMITH: {
    shopName: "Blade Smith",
    proprietors: ["Forge-master Rye", "Edge Wren", "Anvil Sera"],
    flavors: ["\"A blade should fit the hand that pays for it.\""],
    categories: ["BLADE"],
    size: [8, 12],
  },
  GUNSMITH: {
    shopName: "Gunsmith",
    proprietors: ["Powder Finn", "Barrel Mae", "Click Tom"],
    flavors: ["\"Keep the powder dry. Keep the aim honest.\""],
    categories: ["RANGED"],
    size: [6, 10],
  },
  MARTIAL: {
    shopName: "Martial Shop",
    proprietors: ["Sensei Koba", "Palm Lin", "Dojo Crow"],
    flavors: ["\"Train hard. Buy once.\""],
    categories: ["UNUSUAL", "POLEARM", "BLUNT"],
    size: [6, 10],
  },
  DOCKSIDE: {
    shopName: "Dockside Arms Dealer",
    proprietors: ["Rusty Peg", "Salt Rat", "Hook-Hand Nell"],
    flavors: ["\"No questions. No receipts. Fair enough?\""],
    categories: ["BLADE", "BLUNT", "UNUSUAL", "RANGED"],
    size: [5, 8],
  },
  MARINE: {
    shopName: "Marine Supplier",
    proprietors: ["Quartermaster Vale", "Sgt. Brant", "Supply Clerk Omi"],
    flavors: ["\"Standard issue. Standard price. Standard results.\""],
    categories: ["BLADE", "RANGED", "BLUNT"],
    size: [5, 8],
  },
  LUXURY: {
    shopName: "Luxury Weaponsmith",
    proprietors: ["Goldleaf Mira", "Collector Dann", "Silk Edge"],
    flavors: ["\"Cheap steel is for cheap lives.\""],
    categories: ["BLADE", "RANGED", "POLEARM"],
    size: [4, 7],
  },
  BLACK_MARKET: {
    shopName: "Black Market Dealer",
    proprietors: ["No-Name", "Shade", "The Broker"],
    flavors: ["\"This one fell off a Marine convoy. That one… don't ask.\""],
    categories: ["BLADE", "RANGED", "UNUSUAL", "BLUNT"],
    size: [4, 7],
  },
};

const ARCHETYPE_THEME_BIAS: Partial<Record<IslandArchetype, WeaponShopTheme[]>> = {
  FISHING: ["DOCKSIDE", "GENERAL", "MARTIAL"],
  PIRATE_HAVEN: ["DOCKSIDE", "BLACK_MARKET", "GENERAL", "BLADE_SMITH"],
  MARINE_FORTRESS: ["MARINE", "GUNSMITH", "GENERAL"],
  TRADING: ["GENERAL", "LUXURY", "BLADE_SMITH", "GUNSMITH"],
  TROPICAL: ["GENERAL", "DOCKSIDE", "MARTIAL"],
  JUNGLE: ["DOCKSIDE", "MARTIAL", "GENERAL"],
  DESERT: ["GENERAL", "MARTIAL", "BLACK_MARKET"],
};

function materialPoolFor(theme: WeaponShopTheme, island: Island | null | undefined): WeaponMaterial[] {
  const danger = island?.dangerLevel ?? 1;
  if (theme === "LUXURY") return ["STEEL", "IVORY", "OBSIDIAN", "SEA_STONE_ALLOY"];
  if (theme === "MARINE") return ["IRON", "STEEL", "BRONZE"];
  if (theme === "DOCKSIDE" || theme === "BLACK_MARKET") {
    return danger >= 3
      ? ["SCRAP", "IRON", "STEEL", "BONE", "OBSIDIAN"]
      : ["SCRAP", "WOOD", "IRON", "BONE", "STEEL"];
  }
  if ((island?.archetype === "FISHING" || island?.archetype === "JUNGLE") && danger <= 2) {
    return ["WOOD", "SCRAP", "BONE", "IRON", "BRONZE"];
  }
  return ["WOOD", "IRON", "BRONZE", "STEEL", "BONE", "IVORY"];
}

function qualityPoolFor(theme: WeaponShopTheme, island: Island | null | undefined): WeaponQuality[] {
  const danger = island?.dangerLevel ?? 1;
  if (theme === "LUXURY") return ["FINE", "MASTERWORK", "STANDARD", "LEGENDARY_CRAFT"];
  if (theme === "MARINE") return ["STANDARD", "FINE", "WORN"];
  if (theme === "DOCKSIDE") return ["RUSTY", "WORN", "STANDARD", "FINE"];
  if (theme === "BLACK_MARKET") return ["RUSTY", "WORN", "STANDARD", "FINE", "MASTERWORK"];
  if (danger <= 1) return ["RUSTY", "WORN", "STANDARD", "FINE"];
  if (danger >= 4) return ["WORN", "STANDARD", "FINE", "MASTERWORK"];
  return ["RUSTY", "WORN", "STANDARD", "FINE", "MASTERWORK"];
}

function priceMultiplierFor(theme: WeaponShopTheme): number {
  if (theme === "LUXURY") return 1.55;
  if (theme === "MARINE") return 1.15;
  if (theme === "BLACK_MARKET") return 0.9;
  if (theme === "DOCKSIDE") return 0.85;
  return 1;
}

function historyPenalty(key: string, history: string[]): number {
  const count = history.filter((entry) => entry === key).length;
  if (count <= 0) return 1;
  if (count === 1) return 0.55;
  if (count === 2) return 0.3;
  return 0.12;
}

function categoryDiversityBonus(category: WeaponCategory, chosen: WeaponCategory[]): number {
  const count = chosen.filter((entry) => entry === category).length;
  if (count === 0) return 1.35;
  if (count === 1) return 0.85;
  return 0.45;
}

function pickTheme(island: Island | null | undefined, rng: RandomService, forced?: WeaponShopTheme): WeaponShopTheme {
  if (forced) return forced;
  if (island?.weaponShopTheme) return island.weaponShopTheme;
  const options = ARCHETYPE_THEME_BIAS[island?.archetype ?? "TROPICAL"] ?? ["GENERAL"];
  return rng.pick(options);
}

function shopKeyFor(islandId: string | null | undefined, theme: WeaponShopTheme): string {
  return `${islandId ?? "sea"}:${theme}`;
}

function filterArchetypes(
  theme: WeaponShopTheme,
  island: Island | null | undefined,
): WeaponArchetype[] {
  const allowed = new Set(THEME_META[theme].categories);
  let pool = WEAPON_ARCHETYPES.filter((entry) => allowed.has(entry.category));

  if (theme === "MARINE") {
    pool = pool.filter((entry) =>
      ["saber", "cutlass", "baton", "rifle", "musket", "flintlock", "spear", "long_spear"].includes(entry.id),
    );
  }
  if (theme === "DOCKSIDE") {
    pool = pool.filter(
      (entry) =>
        entry.tags.includes("pirate") ||
        entry.tags.includes("improvised") ||
        entry.tags.includes("boarding") ||
        entry.tags.includes("dockside") ||
        entry.category === "BLADE" ||
        entry.category === "BLUNT",
    );
  }
  if (theme === "MARTIAL") {
    pool = pool.filter(
      (entry) =>
        entry.tags.includes("martial") ||
        entry.tags.includes("training") ||
        entry.id === "staff" ||
        entry.id === "bo_staff" ||
        entry.id === "tonfa" ||
        entry.id === "gauntlets" ||
        entry.id === "knuckles" ||
        entry.id === "naginata",
    );
  }
  if (island?.archetype === "FISHING" && theme === "GENERAL") {
    pool = pool.filter((entry) => entry.priceBase <= 220 || entry.tags.includes("naval"));
  }
  return pool.length ? pool : WEAPON_ARCHETYPES;
}

function structuredSlots(count: number): Array<"common" | "mid" | "distinct" | "build" | "rare"> {
  const slots: Array<"common" | "mid" | "distinct" | "build" | "rare"> = [];
  slots.push("common");
  if (count >= 2) slots.push("common");
  if (count >= 3) slots.push("mid");
  if (count >= 4) slots.push("mid");
  if (count >= 5) slots.push("distinct");
  if (count >= 6) slots.push("build");
  while (slots.length < count) {
    slots.push(slots.length % 3 === 0 ? "rare" : "mid");
  }
  if (count >= 5) {
    slots[slots.length - 1] = "rare";
  }
  return slots.slice(0, count);
}

export const WeaponShopService = {
  stockRefreshDays: STOCK_REFRESH_DAYS,

  shopKey(islandId: string | null | undefined, theme: WeaponShopTheme): string {
    return shopKeyFor(islandId, theme);
  },

  resolveTheme(run: RunState, rng: RandomService, forced?: WeaponShopTheme): WeaponShopTheme {
    const island = IslandService.getCurrentIsland(run);
    return pickTheme(island, rng, forced);
  },

  getStock(run: RunState, shopKey: string): WeaponShopStock | null {
    return run.weaponShops?.[shopKey] ?? null;
  },

  ensureStock(
    run: RunState,
    rng: RandomService,
    options?: { theme?: WeaponShopTheme; forceRefresh?: boolean },
  ): WeaponShopStock {
    const island = IslandService.getCurrentIsland(run);
    const theme = pickTheme(island, rng, options?.theme);
    if (island && !island.weaponShopTheme) {
      island.weaponShopTheme = theme;
    }
    const key = shopKeyFor(island?.id, island?.weaponShopTheme ?? theme);
    const existing = run.weaponShops?.[key];
    if (existing && !options?.forceRefresh && run.day < existing.refreshOnDay) {
      return existing;
    }
    const stock = this.generateStock(run, rng, island?.weaponShopTheme ?? theme, key);
    if (!run.weaponShops) {
      run.weaponShops = {};
    }
    run.weaponShops[key] = stock;
    return stock;
  },

  generateStock(
    run: RunState,
    rng: RandomService,
    theme: WeaponShopTheme,
    shopKey: string,
  ): WeaponShopStock {
    const island = IslandService.getCurrentIsland(run);
    const meta = THEME_META[theme];
    const [minSize, maxSize] = meta.size;
    let count = rng.nextInt(minSize, maxSize);
    if (island?.archetype === "FISHING" && theme === "GENERAL") {
      count = rng.nextInt(3, 5);
    }
    if (theme === "LUXURY" || theme === "BLACK_MARKET") {
      count = rng.nextInt(meta.size[0], meta.size[1]);
    }

    const archetypes = filterArchetypes(theme, island);
    const materials = materialPoolFor(theme, island);
    const qualities = qualityPoolFor(theme, island);
    const history = run.recentShopWeaponKeys ?? [];
    const preferredTypes = WeaponGenerationService.preferredWeaponTypes(run.player);
    const slots = structuredSlots(count);
    const listings: WeaponShopListing[] = [];
    const chosenCategories: WeaponCategory[] = [];
    const usedKeys = new Set<string>();
    const priceMul = priceMultiplierFor(theme);

    for (const slot of slots) {
      let weapon: GeneratedWeapon;

      if (slot === "rare" && (theme === "BLACK_MARKET" || theme === "LUXURY" ? rng.chance(0.35) : rng.chance(0.12))) {
        weapon = WeaponGenerationService.generateNamed(rng);
      } else {
        const weighted = archetypes.map((archetype) => {
          let weight = 1;
          weight *= categoryDiversityBonus(archetype.category, chosenCategories);
          if (preferredTypes.includes(archetype.weaponType) && (slot === "build" || slot === "mid")) {
            weight *= 1.4;
          }
          if (slot === "common" && archetype.priceBase > 160) weight *= 0.35;
          if (slot === "common" && archetype.priceBase <= 100) weight *= 1.5;
          if (slot === "distinct" && chosenCategories.includes(archetype.category)) weight *= 0.2;
          if (slot === "rare" && archetype.priceBase < 180) weight *= 0.4;
          // Sample a provisional key penalty using likely material/quality averages
          const sampleKey = `${archetype.id}:IRON:STANDARD`;
          weight *= historyPenalty(sampleKey, history);
          const archHistory = history.filter((entry) => entry.startsWith(`${archetype.id}:`)).length;
          if (archHistory >= 2) weight *= 0.4;
          if (archHistory >= 4) weight *= 0.25;
          return { archetype, weight: Math.max(0.05, weight) };
        });

        const picked = rng.pickWeighted(weighted).archetype;
        let material = WeaponGenerationService.pickMaterial(rng, materials);
        let quality = WeaponGenerationService.pickQuality(rng, qualities);

        if (slot === "common") {
          quality = rng.pick(qualities.filter((entry) => entry === "RUSTY" || entry === "WORN" || entry === "STANDARD").length
            ? qualities.filter((entry) => entry === "RUSTY" || entry === "WORN" || entry === "STANDARD")
            : qualities);
          material = rng.pick(
            materials.filter((entry) => entry === "WOOD" || entry === "SCRAP" || entry === "IRON" || entry === "BONE")
              .length
              ? materials.filter((entry) => entry === "WOOD" || entry === "SCRAP" || entry === "IRON" || entry === "BONE")
              : materials,
          );
        }
        if (slot === "rare") {
          quality = rng.pick(
            qualities.filter((entry) => entry === "FINE" || entry === "MASTERWORK" || entry === "LEGENDARY_CRAFT")
              .length
              ? qualities.filter((entry) => entry === "FINE" || entry === "MASTERWORK" || entry === "LEGENDARY_CRAFT")
              : qualities,
          );
        }

        weapon = WeaponGenerationService.generate(rng, {
          archetype: picked,
          material,
          quality,
          priceMultiplier: priceMul,
        });
      }

      const key = WeaponGenerationService.repetitionKey(weapon);
      if (usedKeys.has(key) && !weapon.isNamed) {
        // Nudge material/quality once to reduce exact duplicates in the same shop.
        weapon = WeaponGenerationService.generate(rng, {
          archetypeId: weapon.archetypeId,
          material: WeaponGenerationService.pickMaterial(rng, materials),
          quality: WeaponGenerationService.pickQuality(rng, qualities),
          priceMultiplier: priceMul,
        });
      }

      usedKeys.add(WeaponGenerationService.repetitionKey(weapon));
      chosenCategories.push(weapon.category);
      listings.push({
        listingId: createId("wsl"),
        weapon,
        sold: false,
      });
    }

    // Ensure category diversity for general/normal shops
    if (theme === "GENERAL" || theme === "DOCKSIDE") {
      const cats = new Set(listings.map((entry) => entry.weapon.category));
      if (cats.size < Math.min(3, listings.length)) {
        const missing = (["BLADE", "POLEARM", "BLUNT", "RANGED", "UNUSUAL"] as WeaponCategory[]).filter(
          (cat) => !cats.has(cat) && THEME_META[theme].categories.includes(cat),
        );
        for (const cat of missing.slice(0, 2)) {
          const target = listings.find((entry) => !entry.weapon.isNamed);
          const arch = archetypes.filter((entry) => entry.category === cat);
          if (target && arch.length) {
            target.weapon = WeaponGenerationService.generate(rng, {
              archetype: rng.pick(arch),
              material: WeaponGenerationService.pickMaterial(rng, materials),
              quality: WeaponGenerationService.pickQuality(rng, qualities),
              priceMultiplier: priceMul,
            });
          }
        }
      }
    }

    this.recordHistory(
      run,
      listings.map((entry) => WeaponGenerationService.repetitionKey(entry.weapon)),
    );

    return {
      shopKey,
      theme,
      shopName: meta.shopName,
      proprietor: rng.pick(meta.proprietors),
      proprietorFlavor: rng.pick(meta.flavors),
      generatedOnDay: run.day,
      refreshOnDay: run.day + STOCK_REFRESH_DAYS,
      listings,
    };
  },

  recordHistory(run: RunState, keys: string[]): void {
    const next = [...(run.recentShopWeaponKeys ?? []), ...keys];
    run.recentShopWeaponKeys = next.slice(-HISTORY_LIMIT);
  },

  availableListings(stock: WeaponShopStock): WeaponShopListing[] {
    return stock.listings.filter((entry) => !entry.sold);
  },

  purchase(
    run: RunState,
    shopKey: string,
    listingId: string,
    options?: { equip?: boolean; tradeInInstanceId?: string },
  ): { ok: boolean; reason: string; instanceId?: string } {
    const stock = run.weaponShops?.[shopKey];
    if (!stock) {
      return { ok: false, reason: "This shop has no stock." };
    }
    const listing = stock.listings.find((entry) => entry.listingId === listingId);
    if (!listing || listing.sold) {
      return { ok: false, reason: "That weapon is no longer available." };
    }

    let tradeCredit = 0;
    let tradedName: string | null = null;
    let tradeSnapshot: ReturnType<typeof WeaponService.findInstance> = undefined;
    if (options?.tradeInInstanceId) {
      tradeSnapshot = WeaponService.findInstance(run.player, options.tradeInInstanceId);
      const tradeView = WeaponService.resolveWeaponView(tradeSnapshot);
      if (!tradeSnapshot || !tradeView) {
        return { ok: false, reason: "Trade-in weapon not found." };
      }
      tradeCredit = WeaponService.sellValue(tradeView);
      tradedName = tradeView.name;
    }

    const price = listing.weapon.price;
    const purse = run.player.berries + tradeCredit;
    if (purse < price) {
      return {
        ok: false,
        reason: `Need ฿${price}${tradeCredit ? ` (฿${tradeCredit} trade-in credit)` : ""}. You have ฿${run.player.berries}.`,
      };
    }

    if (options?.tradeInInstanceId) {
      const removed = WeaponService.removeWeaponInstance(run, options.tradeInInstanceId);
      if (!removed) {
        return { ok: false, reason: "Could not take the trade-in weapon." };
      }
      run.player.berries += tradeCredit;
    }

    run.player.berries -= price;
    listing.sold = true;
    const granted = WeaponService.grantGeneratedWeapon(run, listing.weapon, {
      skipDisposition: true,
      autoEquip: options?.equip === true,
    });
    if (!granted) {
      run.player.berries += price;
      listing.sold = false;
      return { ok: false, reason: "Could not add the weapon to your pack." };
    }

    const net = Math.max(0, price - tradeCredit);
    const netLabel =
      tradeCredit > 0 ? ` Traded in ${tradedName} for ฿${tradeCredit}; net cost ฿${net}.` : "";
    if (options?.equip) {
      return {
        ok: true,
        reason: `Bought and equipped ${listing.weapon.name}.${netLabel || ` Paid ฿${price}.`}`,
        instanceId: granted,
      };
    }
    return {
      ok: true,
      reason: `Bought ${listing.weapon.name}.${netLabel || ` Paid ฿${price}.`} It sits in your backpack.`,
      instanceId: granted,
    };
  },

  sellOwned(run: RunState, instanceId: string): { ok: boolean; reason: string } {
    return WeaponService.sellWeapon(run, instanceId);
  },

  inspectWeights(run: RunState, theme: WeaponShopTheme): Array<{ archetypeId: string; weight: number }> {
    const island = IslandService.getCurrentIsland(run);
    const archetypes = filterArchetypes(theme, island);
    const history = run.recentShopWeaponKeys ?? [];
    const chosen: WeaponCategory[] = [];
    return archetypes.map((archetype) => {
      let weight = 1;
      weight *= categoryDiversityBonus(archetype.category, chosen);
      const archHistory = history.filter((entry) => entry.startsWith(`${archetype.id}:`)).length;
      if (archHistory >= 2) weight *= 0.4;
      if (archHistory >= 4) weight *= 0.25;
      weight *= historyPenalty(`${archetype.id}:IRON:STANDARD`, history);
      return { archetypeId: archetype.id, weight: Math.round(weight * 100) / 100 };
    });
  },
};
