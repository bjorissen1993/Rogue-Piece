import type { LoreEntryDefinition } from "../models/types";

export const RACE_LORE: Record<string, LoreEntryDefinition[]> = {
  HUMAN: [
    {
      id: "intro",
      minLevel: 1,
      title: "The Common Tide",
      body: "Humans fill every sea and every flag. No gift of blood — only hunger, craft, and the will to keep sailing.",
    },
    {
      id: "ambition",
      minLevel: 2,
      title: "Ambition",
      body: "What they lack in birthright they make up in numbers and nerve. Most legends on the sea were born ordinary.",
    },
  ],
  FISH_MAN: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A person of the sea, scaled or gilled, standing on two legs. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Strength that shames most humans, especially in the water. Fish-Man Karate treats air like current.",
    },
    {
      id: "history",
      minLevel: 3,
      title: "Surface Memory",
      body: "Many still remember chains, markets, and Marine indifference. Kindness from a surface-dweller is never assumed.",
    },
    {
      id: "deep",
      minLevel: 4,
      title: "The Deep Kingdoms",
      body: "Fish-Man Island sits in the shadow of Noah and old pacts. Their politics run as deep as the trench.",
    },
  ],
  MERFOLK: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A graceful figure of the deep, too easily called a legend by surface sailors. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "At home in current and song. Faster in water than almost anything that breathes air.",
    },
    {
      id: "courts",
      minLevel: 3,
      title: "Tide Courts",
      body: "Merfolk kingdoms keep their own manners. A voice that can still a riot is not a myth they bother to hide.",
    },
  ],
  MINK: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "An animal-featured warrior, not a beast in a coat. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Athletic, fiercely loyal, and born with Electro — living current in claw and fist.",
    },
    {
      id: "sulong",
      minLevel: 3,
      title: "Sulong",
      body: "Under a full moon, some Minks can become Sulong: a lunar transformation. It is an ability, not a separate people.",
    },
    {
      id: "sulong_lore",
      minLevel: 4,
      title: "The Moon's Price",
      body: "Sulong multiplies speed and violence until the body can barely hold it. Without training, the form can burn a Mink out. Zou, the walking island, is their home — when they speak of it at all.",
    },
  ],
  GIANT: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A person the size of a house, if the stories are even half true. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Colossal strength and reach. Slow to start, ruinous when they land.",
    },
    {
      id: "elbaph",
      minLevel: 3,
      title: "Elbaph",
      body: "Warriors of Elbaph and the far north. Honor, mead, and a history of mercenary work across the seas.",
    },
  ],
  SKY_PERSON: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "Small wings. A person who should not be at sea level. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Skypiean, Shandian, and Birkan are origins among one race — Sky People — not three separate peoples.",
    },
    {
      id: "islands",
      minLevel: 3,
      title: "White-White Sea",
      body: "Sky islands sit on clouds the Blues were never meant to touch. Dial-craft and old wars live up there still.",
    },
  ],
  LONGARM: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "Arms with an extra joint. A handshake becomes a question. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Reach that most fighters do not expect. A boxing tradition built around that second elbow.",
    },
  ],
  LONGLEG: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A stride that eats decks. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Kicks and distance in equal measure. Circuses and wars have both hired them.",
    },
  ],
  SNAKENECK: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A serpentine neck above a scholar's coat — or a spy's. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "They see over crowds and into rooms. Useful in libraries. Useful in other places too.",
    },
  ],
  THREE_EYE: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A third eye, closed or watching. A lineage that should have vanished. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Said to perceive what others cannot. Poneglyphs are whispered in the same breath.",
    },
    {
      id: "awakening",
      minLevel: 3,
      title: "The Closed Eye",
      body: "The third eye does not open for everyone. Those who chase it treat the gift as a sentence as much as a blessing.",
    },
  ],
  TONTATTA: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "A person no taller than a keg, with a warrior's stare. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Tiny Might: a small frame and startling strength. Green Bit is named in the same stories.",
    },
  ],
  ANCIENT_GIANT: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "Even giants lower their voices. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "A primordial frame from an older age of the world. Horns, scale, and size that rewrite a horizon.",
    },
    {
      id: "myth",
      minLevel: 3,
      title: "Almost a Myth",
      body: "Records are scarce on purpose. What remains reads like a warning, not a census.",
    },
  ],
  BUCCANEER: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "Immense strength in a body the world tried to unwrite. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Boundless strength. A persecuted race. History books skip the chapter.",
    },
    {
      id: "erasure",
      minLevel: 3,
      title: "Erasure",
      body: "The World Government still fears what it failed to finish. Survivors do not advertise the name.",
    },
  ],
  LUNARIAN: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Sight",
      body: "Dark wings. A plume of fire. A people the maps no longer list. More information unknown.",
    },
    {
      id: "traits",
      minLevel: 2,
      title: "Known Traits",
      body: "Flame along the back, and a body that endures it. Near-extinct. Hunted.",
    },
    {
      id: "hunt",
      minLevel: 3,
      title: "The Hunt",
      body: "The Government pays for Lunarian blood and Lunarian secrets. The last of them do not walk in daylight on purpose.",
    },
    {
      id: "old_land",
      minLevel: 4,
      title: "A Forgotten Sky",
      body: "Older murals put wings and fire above a red land that no longer appears on any chart the Marines will stamp.",
    },
  ],
};

export const FRUIT_LORE: Record<string, LoreEntryDefinition[]> = {
  bara_bara: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Bara Bara no Mi. A Paramecia. The user's body splits apart and reforms at will.",
    },
    {
      id: "blades",
      minLevel: 2,
      title: "Against Steel",
      body: "Blades pass through the gaps. That is the point of the fruit, and the joke of every swordsman who meets it.",
    },
  ],
  bomu_bomu: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Bomu Bomu no Mi. A Paramecia. The user's body and breath become living explosives.",
    },
    {
      id: "noise",
      minLevel: 2,
      title: "A Loud Gift",
      body: "There is no subtle version of this power. Rookies love it. Neighbors do not.",
    },
  ],
  bari_bari: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Bari Bari no Mi. A Paramecia. The user can raise unbreakable barriers from thin air.",
    },
    {
      id: "wall",
      minLevel: 2,
      title: "The Wall",
      body: "A barrier that does not care about muskets. Getting around it is the whole problem.",
    },
  ],
  doru_doru: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Doru Doru no Mi. A Paramecia. The user secretes and shapes candle wax as hard as steel.",
    },
    {
      id: "wax",
      minLevel: 2,
      title: "Hard Wax",
      body: "Corridors, cages, and armor — all of it poured, then set.",
    },
  ],
  inu_wolf: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Inu Inu no Mi: Wolf. A Zoan. The user can transform into a wolf and a hybrid beast.",
    },
    {
      id: "hunt",
      minLevel: 2,
      title: "The Hunt Shape",
      body: "Nose, teeth, and a body that wants to run. Hybrid form keeps the hands.",
    },
  ],
  neko_leopard: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Neko Neko no Mi: Leopard. A Zoan. Muscle and sudden speed in one hide.",
    },
    {
      id: "pounce",
      minLevel: 2,
      title: "Pounce",
      body: "The hybrid form is a fighter's fruit: reach, claw, and a leap that ends arguments.",
    },
  ],
  mera_mera: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Mera Mera no Mi. A Logia. The user becomes living fire.",
    },
    {
      id: "logia",
      minLevel: 2,
      title: "Living Flame",
      body: "Ordinary blows pass through. Haki, sea-stone, and cleverness are the remaining answers.",
    },
  ],
  suna_suna: [
    {
      id: "intro",
      minLevel: 1,
      title: "First Find",
      body: "The Suna Suna no Mi. A Logia. The user becomes sand, draining moisture and vanishing on the wind.",
    },
    {
      id: "desert",
      minLevel: 2,
      title: "A Dry Death",
      body: "Sand that drinks. A fruit that turns a deck into a dune if given time.",
    },
  ],
};

export const FRUIT_TECHNIQUES: Record<string, Array<{ id: string; name: string; description: string }>> = {
  bara_bara: [
    { id: "split", name: "Bara Split", description: "The body comes apart at the joints, leaving blades nothing to hold." },
    { id: "cannon", name: "Bara Cannon", description: "A fist launched like shot, then reeled back on an invisible string." },
  ],
  bomu_bomu: [
    { id: "nose_fancy", name: "Nose Fancy Cannon", description: "A mucus-charged blast. Undignified. Effective." },
    { id: "kick_bomb", name: "Explosive Kick", description: "A kick that detonates on contact." },
  ],
  bari_bari: [
    { id: "barrier", name: "Barrier", description: "A wall of force that does not negotiate with muskets." },
    { id: "crash", name: "Barrier Crash", description: "The wall becomes a ram." },
  ],
  doru_doru: [
    { id: "wax_wall", name: "Wax Wall", description: "A hardening flood that seals a corridor." },
    { id: "wax_armor", name: "Candle Armor", description: "Wax set as plate, brittle only to those who know fire." },
  ],
  inu_wolf: [
    { id: "hybrid", name: "Wolf Hybrid", description: "Hands and fangs in the same shape." },
    { id: "full_beast", name: "Full Beast", description: "Four legs, a hunt-scent, and no more conversation." },
  ],
  neko_leopard: [
    { id: "hybrid", name: "Leopard Hybrid", description: "A fighter's middle form: claw, reach, and a human mind." },
    { id: "pounce", name: "Pounce", description: "A leap that ends on the sternum." },
  ],
  mera_mera: [
    { id: "fire_fist", name: "Fire Fist", description: "A punch thrown as a column of flame." },
    { id: "firefly", name: "Firefly", description: "Small lights that drift, then bloom into fire." },
    { id: "flame_body", name: "Flame Body", description: "The user lets a blow pass through as heat and light." },
  ],
  suna_suna: [
    { id: "sand_body", name: "Sand Body", description: "Flesh becomes grit. Blades find nothing to cut." },
    { id: "desiccate", name: "Desiccate", description: "Moisture pulled out of wood, fruit, and people." },
  ],
};

export function loreForRace(raceId: string): LoreEntryDefinition[] {
  return RACE_LORE[raceId] ?? [];
}

export function loreForFruit(fruitId: string): LoreEntryDefinition[] {
  return FRUIT_LORE[fruitId] ?? [];
}

export function techniquesForFruit(fruitId: string): Array<{ id: string; name: string; description: string }> {
  return FRUIT_TECHNIQUES[fruitId] ?? [];
}
