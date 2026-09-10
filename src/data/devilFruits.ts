import type { DevilFruit } from "../models/types";

export const DEVIL_FRUITS: DevilFruit[] = [
  {
    id: "bara_bara",
    name: "Bara Bara no Mi",
    type: "PARAMECIA",
    description: "The user's body splits apart and reforms at will, making blades almost useless.",
    rarity: 2,
    effects: [{ type: "STAT", stat: "defense", value: 3 }],
  },
  {
    id: "bomu_bomu",
    name: "Bomu Bomu no Mi",
    type: "PARAMECIA",
    description: "The user's body and breath become living explosives.",
    rarity: 3,
    effects: [{ type: "STAT", stat: "strength", value: 4 }],
  },
  {
    id: "bari_bari",
    name: "Bari Bari no Mi",
    type: "PARAMECIA",
    description: "The user can raise unbreakable barriers from thin air.",
    rarity: 3,
    effects: [{ type: "STAT", stat: "defense", value: 5 }],
  },
  {
    id: "doru_doru",
    name: "Doru Doru no Mi",
    type: "PARAMECIA",
    description: "The user secretes and shapes candle wax as hard as steel.",
    rarity: 2,
    effects: [
      { type: "STAT", stat: "defense", value: 2 },
      { type: "STAT", stat: "willpower", value: 1 },
    ],
  },
  {
    id: "inu_wolf",
    name: "Inu Inu no Mi: Wolf",
    type: "ZOAN",
    description: "The user can transform into a wolf and a hybrid beast.",
    rarity: 3,
    effects: [
      { type: "STAT", stat: "strength", value: 2 },
      { type: "STAT", stat: "speed", value: 2 },
    ],
  },
  {
    id: "neko_leopard",
    name: "Neko Neko no Mi: Leopard",
    type: "ZOAN",
    description: "The user can transform into a leopard, all muscle and sudden speed.",
    rarity: 4,
    effects: [
      { type: "STAT", stat: "strength", value: 3 },
      { type: "STAT", stat: "speed", value: 3 },
    ],
  },
  {
    id: "mera_mera",
    name: "Mera Mera no Mi",
    type: "LOGIA",
    description: "The user becomes living fire, slipping through attacks as flame.",
    rarity: 5,
    effects: [{ type: "STAT", stat: "strength", value: 5 }],
  },
  {
    id: "suna_suna",
    name: "Suna Suna no Mi",
    type: "LOGIA",
    description: "The user becomes sand, draining moisture and vanishing on the wind.",
    rarity: 5,
    effects: [
      { type: "STAT", stat: "speed", value: 3 },
      { type: "STAT", stat: "strength", value: 2 },
    ],
  },
];

export function getDevilFruit(id: string): DevilFruit | undefined {
  return DEVIL_FRUITS.find((fruit) => fruit.id === id);
}

export function requireDevilFruit(id: string): DevilFruit {
  const fruit = getDevilFruit(id);
  if (!fruit) {
    throw new Error(`Unknown Devil Fruit: ${id}`);
  }
  return fruit;
}
