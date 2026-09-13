import type { Encounter, EncounterChoice, RegionId } from "../models/types";
import { EXTENDED_ENCOUNTERS } from "./encounterExtensions";

const ALL_SEAS: RegionId[] = ["EAST_BLUE", "SOUTH_BLUE", "WEST_BLUE", "NORTH_BLUE", "GRAND_LINE"];

function fruitChoices(fruitId: string): EncounterChoice[] {
  return [
    {
      id: "eat",
      text: "Eat the fruit",
      conditions: [{ type: "HAS_EATEN_FRUIT", negate: true }],
      visual: { icon: "Devil_Fruit" },
      outcome: {
        text: "The taste is worse than rotting kelp. Power crawls through your bones as the {fruitName} takes hold. The sea will never welcome you the same way again.",
        devilFruit: { action: "EAT", fruitId },
        addPlayerFlags: ["ate_devil_fruit"],
        worldNews: "{playerName} has eaten the {fruitName}.",
      },
    },
    {
      id: "keep",
      text: "Keep the fruit",
      visual: { icon: "Devil_Fruit" },
      outcome: {
        text: "You wrap the {fruitName} in cloth and hide it in your pack. Power like this can wait — or be sold to someone desperate.",
        devilFruit: { action: "KEEP", fruitId },
      },
    },
    {
      id: "sell",
      text: "Sell the fruit",
      visual: { icon: "Devil_Fruit" },
      outcome: {
        text: "You know a dockside fence who asks no questions. The {fruitName} leaves your hands in exchange for a heavy pouch. Somewhere out there, it will find a new owner.",
        devilFruit: { action: "SELL", fruitId },
        addPlayerFlags: [`sold_fruit_${fruitId}`],
        addWorldFlags: [`player_sold_${fruitId}`],
      },
    },
    {
      id: "leave",
      text: "Leave it",
      visual: { icon: "Bad_Devil_Fruit" },
      outcome: {
        text: "You walk away. The {fruitName} stays where the tide (or a fool) will find it.",
        devilFruit: { action: "LEAVE", fruitId },
      },
    },
  ];
}

export const ENCOUNTERS: Encounter[] = [
  {
    id: "floating_crate",
    title: "Floating Crate",
    category: "Flotsam",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png", variant: "default" },
    description:
      "A sealed crate knocks against your hull, half-swallowed by foam. Someone lost this. Or someone wanted it gone.",
    weight: 12,
    choices: [
      {
        id: "pull",
        text: "Pull it aboard",
        outcome: {
          text: "You haul the crate up and pry it open.",
          randomTable: [
            {
              weight: 45,
              outcome: {
                text: "Oilcloth and coin. Somebody's payday is now yours.",
                berriesChange: 120,
              },
            },
            {
              weight: 16,
              outcome: {
                text: "Dried meat, still good. You eat like a person who remembers hunger.",
                hpChange: 18,
                grantItemIds: ["dried_meat"],
              },
            },
            {
              weight: 10,
              outcome: {
                text: "A corked bottle of bitter medicine, packed in straw. Someone expected a worse voyage than they got.",
                grantItemIds: ["medicine"],
              },
            },
            {
              weight: 8,
              outcome: {
                text: "Oilcloth, a fuse, and a charge that smells like a bad idea. A smoke bomb.",
                grantItemIds: ["smoke_bomb"],
              },
            },
            {
              weight: 12,
              outcome: {
                text: "A rusty cutlass with decent balance. You keep it.",
                statChanges: { strength: 1 },
                grantItemIds: ["rusty_cutlass"],
              },
            },
            {
              weight: 12,
              outcome: {
                text: "Rotten grain and a drowned rat. You dump it overboard and try not to think about the smell.",
                hpChange: -4,
              },
            },
          ],
        },
      },
      {
        id: "ignore",
        text: "Ignore it",
        outcome: {
          text: "You let the crate drift. The sea keeps its secrets, and so do you.",
        },
      },
    ],
  },
  {
    id: "marine_patrol",
    title: "Marine Patrol",
    category: "Authority",
    visual: { overlay: "DARK", background: "/backgrounds/sea.png", variant: "fight" },
    description:
      "A Marine cutter cuts across your wake. A megaphone crackles: they want names, papers, and a look at your hold.",
    weight: 10,
    choices: [
      {
        id: "fight",
        text: "Fight",
        flavour: "Steel comes out. The patrol did not expect a real fight.",
        checkStat: "strength",
        risk: "MODERATE",
        visual: { variant: "fight" },
        outcome: {
          text: "Steel comes out. The patrol did not expect a real fight.",
          combat: {
            enemyName: "Marine Patrol",
            enemyStrength: 6,
            win: {
              text: "You drive them off. One of them swears your name into a notebook as they retreat.",
              berriesChange: 180,
              bountyChange: 800,
              worldNews: "Marines report a violent clash with {playerName}.",
              factionChanges: [
                { factionId: "MARINES", amount: -8, reason: "Fought a Marine patrol" },
                { factionId: "WORLD_GOVERNMENT", amount: -3, reason: "Resisted Marine authority" },
                { factionId: "PIRATES", amount: 2, reason: "Bloodied a Marine cutter" },
              ],
            },
            lose: {
              text: "A rifle butt finds your ribs. You break away leaking, with a new name on their list.",
              hpChange: -22,
              bountyChange: 400,
              factionChanges: [
                { factionId: "MARINES", amount: -3, reason: "Clashed with a Marine patrol" },
              ],
            },
          },
        },
      },
      {
        id: "run",
        text: "Run",
        flavour: "Throw the tiller and hope the wind likes you more than they do.",
        checkStat: "speed",
        risk: "MODERATE",
        visual: { variant: "escape" },
        outcome: {
          text: "You throw the tiller and hope the wind likes you more than they do.",
          skillCheck: {
            stat: "speed",
            difficulty: 8,
            success: {
              text: "You vanish behind a swell. Their shouts fade into spray.",
            },
            failure: {
              text: "A shot grazes the rail — and you. They get a good look at your face.",
              hpChange: -12,
              bountyChange: 250,
            },
          },
        },
      },
      {
        id: "talk",
        text: "Talk",
        flavour: "A smile that has gotten you out of worse rooms than this.",
        checkStat: "charisma",
        risk: "LOW",
        visual: { variant: "parley" },
        outcome: {
          text: "You put on a smile that has gotten you out of worse rooms than this.",
          skillCheck: {
            stat: "charisma",
            difficulty: 8,
            success: {
              text: "You spin a story about legitimate cargo and a sick cousin. They wave you through, almost embarrassed.",
              berriesChange: 40,
              factionChanges: [
                { factionId: "MARINES", amount: 4, reason: "Cooperated with a Marine patrol" },
              ],
            },
            failure: {
              text: "Your story has holes. They do not arrest you, but they write your name down carefully.",
              bountyChange: 350,
            },
          },
        },
      },
      {
        id: "flame_slip",
        text: "Slip past as flame",
        conditions: [{ type: "PLAYER_FRUIT", fruitId: "mera_mera" }],
        outcome: {
          text: "You come apart into fire, race the length of their deck, and are gone before a musket is raised. They will not file this honestly.",
          bountyChange: 150,
        },
      },
    ],
  },
  {
    id: "sea_king",
    title: "Sea King",
    category: "The Deep",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png", variant: "fight" },
    description:
      "The water goes black beneath you. A ridge of spines breaks the surface, then an eye the size of a dinghy.",
    weight: 3,
    regions: ALL_SEAS,
    choices: [
      {
        id: "fight",
        text: "Fight",
        flavour: "Meet a god of the deep with whatever you have. This is a choice, not an accident.",
        checkStat: "strength",
        risk: "DEADLY",
        visual: { variant: "fight" },
        outcome: {
          text: "You meet a god of the deep with whatever you have.",
          combat: {
            enemyName: "Sea King",
            enemyStrength: 11,
            enemyHp: 160,
            combatKind: "BOSS",
            enemyRole: "BOSS",
            enemyFamily: "SEA_BEAST",
            compositionTemplateId: "SEA_BEAST",
            enemyCount: 1,
            canEscape: true,
            canSurrender: true,
            win: {
              text: "It sounds impossible even as you do it. The beast peels away, bleeding into its own kingdom. Word of this will travel.",
              berriesChange: 400,
              bountyChange: 2000,
              statChanges: { strength: 1 },
              worldNews: "Sailors swear {playerName} wounded a Sea King and lived.",
              addMilestones: ["defeated_sea_king"],
            },
            lose: {
              text: "Teeth like oars close on the rail. You survive by luck and a lot of blood.",
              hpChange: -35,
            },
          },
        },
      },
      {
        id: "escape",
        text: "Escape",
        flavour: "Pride is cheaper than being swallowed.",
        checkStat: "speed",
        risk: "HIGH",
        visual: { variant: "escape" },
        outcome: {
          text: "Pride is cheaper than being swallowed.",
          skillCheck: {
            stat: "speed",
            difficulty: 9,
            success: {
              text: "You cut toward shallows. The beast loses interest in wood when the reef begins.",
            },
            failure: {
              text: "A tail slaps the hull. You stay afloat. Barely.",
              hpChange: -18,
            },
          },
        },
      },
      {
        id: "barrier",
        text: "Raise a barrier",
        conditions: [{ type: "PLAYER_FRUIT", fruitId: "bari_bari" }],
        outcome: {
          text: "A wall of force takes the bite meant for your keel. The Sea King tests it once, then sinks away, annoyed.",
          statChanges: { willpower: 1 },
        },
      },
    ],
  },
  {
    id: "hungry_village",
    title: "Hungry Village",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description:
      "The island's only village is all ribs and quiet children. A woman meets your eyes and does not beg. She just waits.",
    weight: 9,
    conditions: [{ type: "PLAYER_FLAG", flag: "visited_hungry_village", negate: true }],
    choices: [
      {
        id: "donate",
        text: "Donate berries",
        conditions: [{ type: "MIN_BERRIES", value: 80 }],
        outcome: {
          text: "You leave enough coin to buy grain. Nobody cheers. A boy does, however, press a dried orange into your hand.",
          berriesChange: -80,
          hpChange: 8,
          statChanges: { charisma: 1 },
          addPlayerFlags: ["helped_hungry_village", "visited_hungry_village"],
          addWorldFlags: ["village_remembers_kindness"],
          worldNews: "A starving village on a no-name island ate well for the first time in weeks.",
          factionChanges: [
            { factionId: "PIRATES", amount: -2, reason: "Fed a village instead of raiding it" },
            { factionId: "CIVILIANS", amount: 8, reason: "Donated berries to a starving village" },
          ],
          worldPowerChanges: { oppression: -2, revolutionaryActivity: 1 },
        },
      },
      {
        id: "ignore",
        text: "Ignore them",
        outcome: {
          text: "You water, you leave. Their silence follows you onto the boat.",
          addPlayerFlags: ["ignored_hungry_village", "visited_hungry_village"],
        },
      },
      {
        id: "rob",
        text: "Rob them",
        outcome: {
          text: "There is not much to take. You take it anyway. Someone will remember your back as you walked away.",
          berriesChange: 140,
          bountyChange: 900,
          statChanges: { charisma: -1 },
          addPlayerFlags: ["robbed_hungry_village", "visited_hungry_village"],
          addWorldFlags: ["village_remembers_theft"],
          worldNews: "Pirates looted a starving village. The name {playerName} is already attached to the story.",
          factionChanges: [
            { factionId: "PIRATES", amount: 3, reason: "Raided a defenseless village" },
            { factionId: "MARINES", amount: -4, reason: "Village raid reported to Marines" },
            { factionId: "CIVILIANS", amount: -15, reason: "Robbed a starving village" },
          ],
          worldPowerChanges: { oppression: 1 },
        },
      },
    ],
  },
  {
    id: "local_pirate_gang",
    title: "Local Pirate Gang",
    visual: { overlay: "SEA", background: "/backgrounds/beach.png" },
    description:
      "Six pirates have claimed the beach with a crooked flag and too much rum. Their captain wants to know if you are prey, rival, or recruit.",
    weight: 8,
    choices: [
      {
        id: "challenge",
        text: "Challenge the captain",
        flavour: "Steel and sand. The circle forms the way it always does.",
        checkStat: "strength",
        risk: "MODERATE",
        visual: { variant: "fight" },
        outcome: {
          text: "The circle forms the way it always does.",
          combat: {
            enemyName: "Beach Captain",
            enemyStrength: 7,
            win: {
              text: "The captain hits the sand. His crew decides you are not worth dying over. You take the purse.",
              berriesChange: 320,
              bountyChange: 1100,
              statChanges: { strength: 1 },
              addPlayerFlags: ["beat_beach_captain"],
              factionChanges: [
                { factionId: "PIRATES", amount: -4, reason: "Challenged and beat a pirate captain" },
              ],
            },
            lose: {
              text: "They kick you down the tide line and keep your dignity. Also some blood.",
              hpChange: -20,
            },
          },
        },
      },
      {
        id: "avoid",
        text: "Avoid them",
        outcome: {
          text: "You give the beach a wide berth. Cowards live longer. Sometimes that is the whole strategy.",
        },
      },
      {
        id: "join",
        text: "Join them temporarily",
        outcome: {
          text: "One night of dirty work: a warehouse, a bribe, a split. You take the coin and not the flag.",
          berriesChange: 160,
          bountyChange: 300,
          addPlayerFlags: ["joined_local_gang"],
          factionChanges: [
            { factionId: "PIRATES", amount: 6, reason: "Worked a job with a local pirate gang" },
            { factionId: "MARINES", amount: -3, reason: "Aided a pirate raid" },
          ],
        },
      },
    ],
  },
  {
    id: "suspicious_merchant",
    title: "Suspicious Merchant",
    visual: { overlay: "DARK", background: "/backgrounds/city.png" },
    description:
      "A covered stall sits too far from the market. The merchant smiles with too many teeth and asks what you are looking for — loudly enough that you know it is a test.",
    weight: 8,
    choices: [
      {
        id: "supplies",
        text: "Buy supplies (50 berries)",
        conditions: [{ type: "MIN_BERRIES", value: 50 }],
        outcome: {
          text: "Bandages, hardtack, and something that claims to be medicine. You feel less like a wreck.",
          berriesChange: -50,
          hpChange: 22,
        },
      },
      {
        id: "rumors",
        text: "Pay for rumors",
        conditions: [{ type: "MIN_BERRIES", value: 20 }],
        outcome: {
          text: "Twenty berries buys a mouthful of half-truths. Some of them will matter later. You cannot tell which.",
          berriesChange: -20,
          worldNews: "Dockside rumor: Devil Fruits are moving again, and old titles will not stay empty forever.",
        },
      },
      {
        id: "leave",
        text: "Walk away",
        outcome: {
          text: "You decide you do not like the smile. The merchant watches you go, still smiling.",
        },
      },
    ],
  },
  {
    id: "injured_stranger",
    title: "Injured Stranger",
    visual: { overlay: "DARK", background: "/backgrounds/city.png" },
    description:
      "A traveler sits against a crate, holding a stained bandage to their side. They look at you like a coin toss.",
    weight: 8,
    conditions: [{ type: "PLAYER_FLAG", flag: "met_injured_stranger", negate: true }],
    choices: [
      {
        id: "help",
        text: "Help them",
        outcome: {
          text: "You clean the wound and share water. They give their name — Mika of the Coast — and a look you will see again.",
          berriesChange: -15,
          hpChange: -2,
          addPlayerFlags: ["helped_injured_stranger", "met_injured_stranger"],
          worldNews: "{playerName} pulled a stranger back from the edge on a nameless dock.",
          factionChanges: [{ factionId: "CIVILIANS", amount: 5, reason: "Helped an injured stranger" }],
          createNpc: {
            id: "npc_mika",
            name: "Mika of the Coast",
            faction: "CIVILIAN",
            strength: 3,
            bounty: 0,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: 4,
            tags: ["known_to_player", "injured_stranger", "mika"],
          },
        },
      },
      {
        id: "rob",
        text: "Rob them",
        outcome: {
          text: "They are in no shape to stop you. You leave them poorer and much less likely to forget your face.",
          berriesChange: 70,
          bountyChange: 450,
          addPlayerFlags: ["robbed_injured_stranger", "met_injured_stranger"],
          factionChanges: [{ factionId: "CIVILIANS", amount: -12, reason: "Robbed a helpless traveler" }],
          createNpc: {
            id: "npc_mika",
            name: "Mika of the Coast",
            faction: "CIVILIAN",
            strength: 3,
            bounty: 0,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: -5,
            tags: ["known_to_player", "injured_stranger", "mika"],
          },
        },
      },
      {
        id: "ignore",
        text: "Ignore them",
        outcome: {
          text: "You keep walking. Plenty of injured people in this era. That is what you tell yourself.",
          addPlayerFlags: ["ignored_injured_stranger", "met_injured_stranger"],
        },
      },
    ],
  },
  {
    id: "rookie_pirate",
    title: "Rookie Pirate",
    visual: { overlay: "DARK", background: "/backgrounds/city.png" },
    description:
      "A loud pirate with a new jolly roger and an older chip on their shoulder blocks the pier. They call themselves Jex. They want a fight, an audience, or both.",
    weight: 8,
    conditions: [{ type: "PLAYER_FLAG", flag: "met_rookie_jex", negate: true }],
    choices: [
      {
        id: "fight",
        text: "Fight",
        flavour: "Jex wanted a story. Steel will write it.",
        checkStat: "strength",
        risk: "MODERATE",
        visual: { variant: "fight" },
        outcome: {
          text: "Jex wanted a story. You can provide one.",
          addPlayerFlags: ["met_rookie_jex"],
          combat: {
            enemyName: "Rookie Jex",
            enemyStrength: 5,
            win: {
              text: "Jex hits the planks, then laughs through blood. 'Next time,' they promise.",
              berriesChange: 220,
              bountyChange: 500,
              addPlayerFlags: ["beat_rookie_jex"],
              createNpc: {
                id: "npc_jex",
                name: "Rookie Jex",
                faction: "PIRATE",
                strength: 5,
                bounty: 800,
                devilFruitId: null,
                alive: true,
                relationshipWithPlayer: -2,
                tags: ["known_to_player", "rookie_jex"],
              },
            },
            lose: {
              text: "Jex is faster than the mouth suggested. You crawl back to your boat with a new bruise and a smaller reputation.",
              hpChange: -16,
              createNpc: {
                id: "npc_jex",
                name: "Rookie Jex",
                faction: "PIRATE",
                strength: 5,
                bounty: 800,
                devilFruitId: null,
                alive: true,
                relationshipWithPlayer: 1,
                tags: ["known_to_player", "rookie_jex"],
              },
            },
          },
        },
      },
      {
        id: "talk",
        text: "Talk",
        flavour: "Words before fists. Jex might even listen.",
        checkStat: "charisma",
        risk: "LOW",
        visual: { variant: "parley" },
        outcome: {
          text: "You try words before fists.",
          skillCheck: {
            stat: "charisma",
            difficulty: 7,
            success: {
              text: "Jex lowers the sword, impressed despite themselves. They buy you a drink and swear they owe you one.",
              berriesChange: 40,
              addPlayerFlags: ["met_rookie_jex", "spared_rookie_jex"],
              createNpc: {
                id: "npc_jex",
                name: "Rookie Jex",
                faction: "PIRATE",
                strength: 5,
                bounty: 800,
                devilFruitId: null,
                alive: true,
                relationshipWithPlayer: 3,
                tags: ["known_to_player", "rookie_jex"],
              },
            },
            failure: {
              text: "Jex decides talking is for people who cannot swing. The fight is shorter than their speech.",
              hpChange: -10,
              addPlayerFlags: ["met_rookie_jex"],
              createNpc: {
                id: "npc_jex",
                name: "Rookie Jex",
                faction: "PIRATE",
                strength: 5,
                bounty: 800,
                devilFruitId: null,
                alive: true,
                relationshipWithPlayer: -1,
                tags: ["known_to_player", "rookie_jex"],
              },
            },
          },
        },
      },
      {
        id: "leave",
        text: "Leave",
        outcome: {
          text: "You step around Jex. They shout something unkind at your back. You keep the peace, and the boredom.",
          addPlayerFlags: ["met_rookie_jex"],
          createNpc: {
            id: "npc_jex",
            name: "Rookie Jex",
            faction: "PIRATE",
            strength: 5,
            bounty: 400,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: 0,
            tags: ["known_to_player", "rookie_jex"],
          },
        },
      },
    ],
  },
  {
    id: "tavern_reunion",
    title: "A Face in the Tavern",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png" },
    description:
      "The tavern is all smoke and cheap rum. Then a familiar voice cuts through it. Mika of the Coast — on their feet this time — raises a cup toward you.",
    weight: 16,
    conditions: [
      { type: "PLAYER_FLAG", flag: "helped_injured_stranger" },
      { type: "PLAYER_FLAG", flag: "tavern_reunion_done", negate: true },
      { type: "NPC_TAGS", tags: ["mika"], alive: true },
    ],
    bindNpcTags: ["mika"],
    choices: [
      {
        id: "news",
        text: "Ask what they have heard",
        outcome: {
          text: "Mika leans in. There is talk of a round fruit with a fuse-like stem washing the East current — explosive, if the stories are even half true. They also slide you a small purse 'for the bandage.'",
          berriesChange: 180,
          addPlayerFlags: ["tavern_reunion_done", "mika_fruit_hint"],
          worldNews: "A traveler speaks of an explosive Devil Fruit still unclaimed on the currents.",
        },
      },
      {
        id: "gift",
        text: "Accept their thanks",
        outcome: {
          text: "Mika presses a smoke bomb into your hand and a thicker envelope of berries. 'I know people. If you ever need a crew, start here.'",
          berriesChange: 220,
          addPlayerFlags: ["tavern_reunion_done", "mika_crew_hint"],
          addInventory: [
            {
              id: "smoke_bomb",
              name: "Smoke Bomb",
              type: "CONSUMABLE",
              description: "A dense charge of black powder and oilcloth. Good for leaving.",
            },
          ],
        },
      },
      {
        id: "contact",
        text: "Keep them as a contact",
        outcome: {
          text: "You talk until the lamps gutter. Mika will remember you in every port that still has a tavern.",
          statChanges: { charisma: 1 },
          addPlayerFlags: ["tavern_reunion_done", "mika_contact"],
        },
      },
    ],
  },
  {
    id: "storm_at_sea",
    title: "Storm at Sea",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png" },
    timeCost: "LONG",
    description:
      "The sky bruises in minutes. Wind hits like a thrown door. Your little world becomes rope, water, and bad decisions.",
    weight: 9,
    regions: ALL_SEAS,
    choices: [
      {
        id: "lash",
        text: "Lash the cargo",
        checkStat: "strength",
        outcome: {
          text: "You go for the lashings before the sea does.",
          skillCheck: {
            stat: "strength",
            difficulty: 7,
            success: {
              text: "Everything that matters stays on board. You taste iron and rain and call it a win.",
              statChanges: { strength: 1 },
            },
            failure: {
              text: "A crate goes over. So does a piece of your hide.",
              berriesChange: -70,
              hpChange: -10,
            },
          },
        },
      },
      {
        id: "ride",
        text: "Ride it out",
        checkStat: "willpower",
        outcome: {
          text: "You take the helm and refuse to blink first.",
          skillCheck: {
            stat: "willpower",
            difficulty: 8,
            success: {
              text: "The storm breaks its teeth on you. You feel taller afterward, which is ridiculous, and also true.",
              statChanges: { willpower: 1 },
            },
            failure: {
              text: "A wave finds the deck with your name on it.",
              hpChange: -16,
            },
          },
        },
      },
      {
        id: "hide",
        text: "Take shelter below",
        outcome: {
          text: "You wedge yourself in the hold and wait. Cowardice keeps the bones attached. Mostly.",
          hpChange: -6,
        },
      },
      {
        id: "sand",
        text: "Scatter into sand",
        conditions: [{ type: "PLAYER_FRUIT", fruitId: "suna_suna" }],
        outcome: {
          text: "You let the wind take you apart and put you back together when the rain thins. The ship has a worse night than you do.",
        },
      },
    ],
  },
  {
    id: "abandoned_marine_camp",
    title: "Abandoned Marine Camp",
    visual: { overlay: "FOG", background: "/backgrounds/jungle.png" },
    description:
      "Tents still stand on a bluff, but the fire is days cold. A Marine banner hangs crooked. Whoever left was in a hurry, or in pieces.",
    weight: 7,
    choices: [
      {
        id: "search",
        text: "Search the tents",
        outcome: {
          text: "You search like a person who has been hungry before.",
          randomTable: [
            {
              weight: 50,
              outcome: {
                text: "Pay chests, half emptied. The rest is yours.",
                berriesChange: 160,
              },
            },
            {
              weight: 30,
              outcome: {
                text: "A serviceable breastplate. Heavy, honest, Marine-issue.",
                statChanges: { defense: 1 },
                addInventory: [
                  {
                    id: "marine_breastplate",
                    name: "Marine Breastplate",
                    type: "MISC",
                    description: "Still stamped with a unit number nobody will claim.",
                  },
                ],
              },
            },
            {
              weight: 20,
              outcome: {
                text: "You find a logbook. The last entry names a fruit moving inland. Then the writing stops.",
                addPlayerFlags: ["read_marine_log"],
                worldNews: "Torn Marine notes mention a Devil Fruit being moved off a forgotten island.",
              },
            },
          ],
        },
      },
      {
        id: "weapons",
        text: "Salvage weapons",
        outcome: {
          text: "You take a rifle and a better knife. If a patrol finds you wearing their iron, they will not ask politely.",
          statChanges: { strength: 1 },
          bountyChange: 150,
          factionChanges: [
            { factionId: "MARINES", amount: -5, reason: "Looted an abandoned Marine camp" },
            { factionId: "WORLD_GOVERNMENT", amount: -2, reason: "Stole Marine-issue arms" },
          ],
        },
      },
      {
        id: "leave",
        text: "Leave it untouched",
        outcome: {
          text: "Some camps are graves that have not admitted it yet. You walk back to the boat.",
        },
      },
    ],
  },
  {
    id: "gambling_den",
    title: "Gambling Den",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png" },
    description:
      "Lanterns, dice, and the particular silence of people losing money they do not have. A table has an empty stool with your name on it.",
    weight: 7,
    choices: [
      {
        id: "bet",
        text: "Bet 100 berries",
        conditions: [{ type: "MIN_BERRIES", value: 100 }],
        outcome: {
          text: "The dice look honest. That is usually the tell.",
          randomTable: [
            {
              weight: 50,
              outcome: {
                text: "The table loves you tonight. You scoop the pot before it changes its mind.",
                berriesChange: 200,
              },
            },
            {
              weight: 50,
              outcome: {
                text: "The table does not love you. You knew that, and you sat down anyway.",
                berriesChange: -100,
              },
            },
          ],
        },
      },
      {
        id: "watch",
        text: "Watch the room",
        outcome: {
          text: "You drink slowly and listen. People confess more to dice than to priests.",
          statChanges: { charisma: 1 },
          worldNews: "Word in the dens: a rookie with a growing bounty has been hopping islands.",
        },
      },
      {
        id: "scene",
        text: "Cause a scene",
        outcome: {
          text: "A shove, a shout, a grabbed purse, and a door that did not want to be kicked. You leave richer and much more famous.",
          berriesChange: 90,
          hpChange: -8,
          bountyChange: 700,
        },
      },
    ],
  },
  {
    id: "deserted_island",
    title: "Deserted Island",
    visual: { overlay: "SEA", background: "/backgrounds/beach.png" },
    description:
      "No smoke, no docks, no flags. Just jungle, a pale beach, and the feeling that something here used to have a name.",
    weight: 8,
    choices: [
      {
        id: "explore",
        text: "Explore inland",
        timeCost: "LONG",
        flavour: "Jungle, ruin, and whatever still lives in it.",
        outcome: {
          text: "The interior does not care that you arrived.",
          randomTable: [
            {
              weight: 40,
              outcome: {
                text: "A ruined shrine and a clay jar of old coins.",
                berriesChange: 90,
              },
            },
            {
              weight: 35,
              outcome: {
                text: "A spring. You drink, wash, and remember what not-hurting feels like.",
                hpChange: 20,
              },
            },
            {
              weight: 25,
              outcome: {
                text: "A trap meant for boar finds your calf instead.",
                hpChange: -14,
              },
            },
          ],
        },
      },
      {
        id: "rest",
        text: "Rest on the beach",
        timeCost: "LONG",
        flavour: "Sleep with one eye open. Time well spent, if the tide stays kind.",
        outcome: {
          text: "You sleep with one eye open and still sleep. The tide keeps watch, more or less.",
          hpChange: 16,
        },
      },
      {
        id: "shore",
        text: "Search the shoreline",
        outcome: {
          text: "Wreckage, a bottle, a boot. Then a pouch sewn into a dead sailor's coat.",
          berriesChange: 60,
        },
      },
    ],
  },
  {
    id: "news_bird",
    title: "News Coo",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png" },
    regions: ALL_SEAS,
    description:
      "A fat news bird crash-lands on your rail, drops a paper, and looks at you like you owe it a sandwich.",
    weight: 6,
    choices: [
      {
        id: "read",
        text: "Read the paper",
        outcome: {
          text: "Headlines from a world that is already rewriting itself. New pirates. Empty chairs in high offices. Your name might be smaller than you think. Or not.",
          bountyChange: 0,
          worldNews: "Papers across the sea speak of vacant power — fruits, fleets, and crowns — waiting for whoever is bold enough.",
          addPlayerFlags: ["read_news_coo"],
        },
      },
      {
        id: "feed",
        text: "Feed the bird (10 berries)",
        conditions: [{ type: "MIN_BERRIES", value: 10 }],
        outcome: {
          text: "You buy goodwill from a creature that flies farther than you do. It leaves a second scrap: a bounty office is paying extra this month.",
          berriesChange: -10,
          statChanges: { charisma: 1 },
        },
      },
      {
        id: "ignore",
        text: "Shoo it off",
        outcome: {
          text: "The bird leaves, offended. You remain uninformed and slightly proud of it.",
        },
      },
    ],
  },
  {
    id: "rival_boarding",
    title: "Rival Boarding",
    category: "Boarding",
    visual: { overlay: "DARK", background: "/backgrounds/sea.png", variant: "fight" },
    regions: ALL_SEAS,
    description:
      "Another small crew hooks your rail. Their captain wants your stores, your flag, or the satisfaction of watching you sink.",
    weight: 8,
    choices: [
      {
        id: "fight",
        text: "Fight them off",
        flavour: "Boarding axes. No speeches.",
        checkStat: "strength",
        risk: "MODERATE",
        visual: { variant: "fight" },
        outcome: {
          text: "Boarding axes. No speeches.",
          combat: {
            enemyName: "Rival Crew",
            enemyStrength: 6,
            win: {
              text: "You throw them back into their own boat. Their purse stays.",
              berriesChange: 240,
              bountyChange: 650,
            },
            lose: {
              text: "They take what they came for and leave you the leak.",
              berriesChange: -80,
              hpChange: -18,
            },
          },
        },
      },
      {
        id: "parley",
        text: "Parley",
        flavour: "Empty hands and a reasonable voice.",
        checkStat: "charisma",
        risk: "MODERATE",
        visual: { variant: "parley" },
        outcome: {
          text: "You raise empty hands and a reasonable voice.",
          skillCheck: {
            stat: "charisma",
            difficulty: 8,
            success: {
              text: "You talk them into believing you are worse prey than you look. They leave looking for easier wood.",
            },
            failure: {
              text: "They take a 'toll' for the privilege of not killing you.",
              berriesChange: -120,
            },
          },
        },
      },
      {
        id: "flee",
        text: "Cut the hooks",
        flavour: "Axes to rope. Run.",
        checkStat: "speed",
        risk: "MODERATE",
        visual: { variant: "escape" },
        outcome: {
          text: "Axes to rope. Run.",
          skillCheck: {
            stat: "speed",
            difficulty: 8,
            success: {
              text: "The lines fall. So does their plan.",
            },
            failure: {
              text: "You are too slow. A boarding axe explains this in detail.",
              hpChange: -14,
            },
          },
        },
      },
    ],
  },
  {
    id: "bomu_ashore",
    title: "Fruit on the Tide Line",
    description:
      "Something round and wrong sits in the wrack. It looks almost like a melon until you see the swirl, and the faint scorched smell. The {fruitName}. Unclaimed. Watching you back, if a fruit can do that.",
    weight: 1.1,
    fruitEncounter: true,
    conditions: [{ type: "FRUIT_STATUS", fruitId: "bomu_bomu", status: "UNCLAIMED" }],
    bindFruit: "bomu_bomu",
    choices: fruitChoices("BOUND"),
  },
  {
    id: "strange_fruit",
    title: "A Strange Fruit",
    description:
      "In a hollow tree / a shrine box / a smuggler's cache — the details will not matter later. What matters is the {fruitName} sitting there, unmarked and ownerless in a world that has started wanting such things again.",
    weight: 0.7,
    fruitEncounter: true,
    conditions: [{ type: "ANY_UNCLAIMED_FRUIT" }],
    bindFruit: "UNCLAIMED",
    choices: fruitChoices("BOUND"),
  },
  {
    id: "explosive_rookie",
    title: "The Explosive Pirate",
    description:
      "{npcName} stands on the dock and grins as small detonations pop from their fingertips, scorching the planks for fun. You know that power. You sold it. The Bomu Bomu no Mi did not stay lost — it found a rookie who likes making noise.",
    weight: 18,
    conditions: [
      { type: "NPC_TAGS", tags: ["acquired_sold_fruit", "fruit_bomu_bomu"], alive: true },
      { type: "PLAYER_FLAG", flag: "met_explosive_rookie", negate: true },
    ],
    bindNpcTags: ["acquired_sold_fruit", "fruit_bomu_bomu"],
    bindFruit: "bomu_bomu",
    choices: [
      {
        id: "fight",
        text: "Fight them",
        outcome: {
          text: "They laugh, then explode forward.",
          addPlayerFlags: ["met_explosive_rookie"],
          combat: {
            enemyName: "Explosive Rookie",
            enemyStrength: 9,
            win: {
              text: "You beat the pirate who bought your mistake. They crawl, still smoking, and spit that the fruit was worth every berry.",
              berriesChange: 500,
              bountyChange: 1800,
              worldNews: "{playerName} clashed with {npcName}, a rookie wielding explosive Devil Fruit powers.",
            },
            lose: {
              text: "The blast throws you into a stack of crates. {npcName} tips an imaginary hat. 'Thanks for the fruit, stranger.'",
              hpChange: -28,
            },
          },
        },
      },
      {
        id: "talk",
        text: "Talk",
        outcome: {
          text: "{npcName} flexes a crackling fist. 'Some fence sold this beauty after a sailor got cold feet. Explosive powers, and I didn't even have to hunt it.' They know enough to make your stomach turn — and not enough to know it was you. Unless they do.",
          addPlayerFlags: ["met_explosive_rookie", "spoke_to_explosive_rookie"],
          bountyChange: 200,
        },
      },
      {
        id: "flee",
        text: "Get out of range",
        outcome: {
          text: "You do not test a person who can detonate their own handshake. {npcName}'s laughter follows you down the pier.",
          addPlayerFlags: ["met_explosive_rookie"],
        },
      },
    ],
  },
  {
    id: "powered_buyer",
    title: "A Familiar Power",
    description:
      "You catch {npcName} using a power you have seen before — the {fruitName}, the one that passed through your hands when you sold it into the world. They do not look like someone who found it by accident.",
    weight: 14,
    conditions: [
      { type: "NPC_TAGS", tags: ["acquired_sold_fruit", "non_bomu_buyer"], alive: true },
      { type: "PLAYER_FLAG", flag: "met_powered_buyer", negate: true },
    ],
    bindNpcTags: ["acquired_sold_fruit", "non_bomu_buyer"],
    choices: [
      {
        id: "fight",
        text: "Fight them",
        outcome: {
          text: "You test the power you once sold.",
          addPlayerFlags: ["met_powered_buyer"],
          combat: {
            enemyName: "Fruit Wielder",
            enemyStrength: 8,
            win: {
              text: "You beat {npcName}. The {fruitName} is still theirs — you only sold the fruit, not the right to take it back with ease.",
              berriesChange: 360,
              bountyChange: 1200,
            },
            lose: {
              text: "{npcName} turns your old sale against you. The {fruitName} hits harder from the other side.",
              hpChange: -24,
            },
          },
        },
      },
      {
        id: "talk",
        text: "Talk",
        outcome: {
          text: "{npcName} flexes the {fruitName} like a trophy. 'Came through the market after some sailor sold it. Lucky me.' They have no idea they are talking to that sailor. Or they do, and they enjoy it.",
          addPlayerFlags: ["met_powered_buyer"],
        },
      },
      {
        id: "leave",
        text: "Leave before it gets worse",
        outcome: {
          text: "You have seen enough. The world kept the fruit. That was the deal.",
          addPlayerFlags: ["met_powered_buyer"],
        },
      },
    ],
  },
  {
    id: "village_thanks",
    title: "The Village Remembers",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description:
      "The same hungry village — less hungry now — spots your boat. People actually come down to the water this time.",
    weight: 14,
    conditions: [
      { type: "PLAYER_FLAG", flag: "helped_hungry_village" },
      { type: "PLAYER_FLAG", flag: "village_thanks_done", negate: true },
    ],
    choices: [
      {
        id: "accept",
        text: "Accept their thanks",
        outcome: {
          text: "They give food, a little coin they cannot spare, and a warning: Marines have been asking about kind strangers and cruel ones.",
          berriesChange: 200,
          hpChange: 20,
          addPlayerFlags: ["village_thanks_done"],
        },
      },
      {
        id: "refuse",
        text: "Refuse the gift",
        outcome: {
          text: "You tell them to keep it. An old man still forces a charm into your pocket. Your name is good here.",
          statChanges: { charisma: 1, willpower: 1 },
          addPlayerFlags: ["village_thanks_done"],
        },
      },
    ],
  },
  {
    id: "wanted_attention",
    title: "Wanted Attention",
    description:
      "Your face is on a cheap print nailed to a post. The art is bad. The number is not. People are looking at you too long.",
    weight: 8,
    conditions: [{ type: "MIN_BOUNTY", value: 500 }],
    choices: [
      {
        id: "hide",
        text: "Keep your head down",
        checkStat: "speed",
        visual: { variant: "escape" },
        outcome: {
          text: "Crowds are a kind of ocean.",
          skillCheck: {
            stat: "speed",
            difficulty: 8,
            success: {
              text: "You are gone before the whispering organizes itself.",
            },
            failure: {
              text: "A would-be hunter gets a piece of you. You get away. The poster will be updated.",
              hpChange: -12,
              bountyChange: 200,
            },
          },
        },
      },
      {
        id: "boast",
        text: "Lean into it",
        outcome: {
          text: "You smile at the poster like it is a compliment. Word travels. So will trouble.",
          bountyChange: 400,
          statChanges: { charisma: 1 },
          worldNews: "The bounty of {playerName} is becoming a tavern sport.",
        },
      },
      {
        id: "pay",
        text: "Bribe the gossip (150 berries)",
        conditions: [{ type: "MIN_BERRIES", value: 150 }],
        outcome: {
          text: "Coin changes what people swear they saw. For a while.",
          berriesChange: -150,
          bountyChange: -200,
        },
      },
    ],
  },
  {
    id: "jex_returns",
    title: "Jex Again",
    description:
      "Rookie Jex finds you in a crowded street, less loud, more useful. 'I said I owed you,' they mutter, like it hurts.",
    weight: 13,
    conditions: [
      { type: "PLAYER_FLAG", flag: "spared_rookie_jex" },
      { type: "PLAYER_FLAG", flag: "jex_returns_done", negate: true },
      { type: "NPC_TAGS", tags: ["rookie_jex"], alive: true },
    ],
    bindNpcTags: ["rookie_jex"],
    choices: [
      {
        id: "take",
        text: "Take the help",
        outcome: {
          text: "Jex dumps a stolen Marine purse on the table and a rumor: someone is shopping for explosive fruit on the black current.",
          berriesChange: 260,
          addPlayerFlags: ["jex_returns_done"],
          worldNews: "A rookie pirate has been asking around about an explosive Devil Fruit.",
        },
      },
      {
        id: "crew",
        text: "Tell them to stay alive",
        outcome: {
          text: "You do not take a crew yet. Jex nods, almost disappointed, and leaves you a better map than you had.",
          statChanges: { willpower: 1 },
          addPlayerFlags: ["jex_returns_done"],
        },
      },
    ],
  },
  {
    id: "stranger_revenge",
    title: "Debts Collect",
    description:
      "Mika of the Coast is not alone this time. A couple of dockhands with pipes block the alley. 'You took from a wounded person,' Mika says. 'We are here to talk about that.'",
    weight: 12,
    conditions: [
      { type: "PLAYER_FLAG", flag: "robbed_injured_stranger" },
      { type: "PLAYER_FLAG", flag: "stranger_revenge_done", negate: true },
      { type: "NPC_TAGS", tags: ["mika"], alive: true },
    ],
    bindNpcTags: ["mika"],
    choices: [
      {
        id: "pay",
        text: "Pay them back (120 berries)",
        conditions: [{ type: "MIN_BERRIES", value: 120 }],
        outcome: {
          text: "You return more than you stole. Mika does not forgive you. They do let you keep your teeth.",
          berriesChange: -120,
          addPlayerFlags: ["stranger_revenge_done"],
        },
      },
      {
        id: "fight",
        text: "Fight your way out",
        outcome: {
          text: "Pipes are still pipes.",
          addPlayerFlags: ["stranger_revenge_done"],
          combat: {
            enemyName: "Mika's Friends",
            enemyStrength: 6,
            win: {
              text: "You leave them on the stones. Mika's look follows you longer than the bruises will.",
              bountyChange: 350,
            },
            lose: {
              text: "They take the coin from your coat and leave you the lesson.",
              berriesChange: -80,
              hpChange: -18,
            },
          },
        },
      },
      {
        id: "run",
        text: "Run",
        outcome: {
          text: "You know alleys. They know this one better. A pipe still clips you on the way out.",
          hpChange: -8,
          addPlayerFlags: ["stranger_revenge_done"],
        },
      },
    ],
  },
  {
    id: "wolf_shrine",
    title: "The Howling Shrine",
    visual: { overlay: "SHADOW", background: "/backgrounds/jungle.png" },
    description:
      "A crumbling shrine in the trees is full of carved wolves. On the altar, if the world has not claimed it yet, something living-still waits: the {fruitName}.",
    weight: 0.6,
    fruitEncounter: true,
    conditions: [{ type: "FRUIT_STATUS", fruitId: "inu_wolf", status: "UNCLAIMED" }],
    bindFruit: "inu_wolf",
    choices: fruitChoices("BOUND"),
  },
  {
    id: "wax_and_war",
    title: "Candlelight Ambush",
    description:
      "Assassins rush you in a corridor of hanging lanterns. Wax, flame, and bad odds.",
    weight: 5,
    conditions: [{ type: "MIN_BOUNTY", value: 800 }],
    choices: [
      {
        id: "fight",
        text: "Fight",
        outcome: {
          text: "Close quarters. Ugly.",
          combat: {
            enemyName: "Lantern Assassins",
            enemyStrength: 7,
            win: {
              text: "You leave them in the wax. The contract on you just got more expensive.",
              bountyChange: 500,
              berriesChange: 150,
            },
            lose: {
              text: "A knife writes a short letter on your side.",
              hpChange: -20,
            },
          },
        },
      },
      {
        id: "wax",
        text: "Seal the hall in wax",
        conditions: [{ type: "PLAYER_FRUIT", fruitId: "doru_doru" }],
        outcome: {
          text: "You flood the corridor with hardening wax. The ambush becomes a museum exhibit.",
          bountyChange: 250,
          statChanges: { willpower: 1 },
        },
      },
      {
        id: "split",
        text: "Come apart and slip through",
        conditions: [{ type: "PLAYER_FRUIT", fruitId: "bara_bara" }],
        outcome: {
          text: "Blades pass through empty air. You reassemble behind them and suggest they find a new career.",
        },
      },
      {
        id: "flee",
        text: "Bolt",
        outcome: {
          text: "You choose the window. The window charges a small fee in glass.",
          hpChange: -7,
        },
      },
    ],
  },
  {
    id: "fishman_cove",
    title: "Cove of Gills",
    description:
      "A hidden inlet. Webbed footprints in the sand. Someone watches from the water — not a human silhouette.",
    weight: 6,
    relevantRaces: ["FISH_MAN"],
    conditions: [{ type: "PLAYER_FLAG", flag: "saw_fishman_cove", negate: true }],
    choices: [
      {
        id: "approach",
        text: "Call out",
        outcome: {
          text: "A Fish-Man hauls himself onto the rocks, taller than any dockhand you know. He speaks the surface tongue with a current in it. He will not give his village's name. He does give you a scale, and a warning: the World Government still writes laws against his people.",
          addPlayerFlags: ["saw_fishman_cove"],
          raceDiscoveries: [{ raceId: "FISH_MAN", sourceId: "fishman_cove" }],
          addInventory: [
            {
              id: "fishman_scale",
              name: "Fish-Man Scale",
              type: "MATERIAL",
              description: "Iridescent, hard, and not from any fish you know.",
            },
          ],
          worldNews: "Sailors mutter about Fish-Men in the East Blue shallows.",
        },
      },
      {
        id: "leave",
        text: "Leave the cove",
        outcome: {
          text: "You back the boat out. The water watches you go. You will remember the shape, even if you never learn the name.",
          addPlayerFlags: ["saw_fishman_cove"],
          raceDiscoveries: [{ raceId: "FISH_MAN", sourceId: "fishman_cove" }],
        },
      },
    ],
  },
  {
    id: "fishman_district",
    title: "The District Below the Piers",
    description:
      "Under the human market, a second market breathes wet air. Fish-Men repair nets, argue prices, and go quiet when a Marine cap appears at the stair.",
    weight: 5,
    relevantRaces: ["FISH_MAN"],
    conditions: [{ type: "PLAYER_FLAG", flag: "saw_fishman_district", negate: true }],
    choices: [
      {
        id: "trade",
        text: "Trade honestly",
        outcome: {
          text: "You buy nothing they cannot spare. An old Fish-Man nods like that is rarer than coin. You leave knowing this is a people, not a rumor.",
          berriesChange: -40,
          addPlayerFlags: ["saw_fishman_district"],
          raceDiscoveries: [{ raceId: "FISH_MAN", sourceId: "fishman_district" }],
          factionChanges: [{ factionId: "WORLD_GOVERNMENT", amount: -1, reason: "Dealt fairly in a Fish-Man district" }],
        },
      },
      {
        id: "listen",
        text: "Listen from the stairs",
        outcome: {
          text: "You hear enough: ten times a human's strength in water, old grudges, a queen's name spoken like a prayer. Then someone notices you, and the district folds shut.",
          addPlayerFlags: ["saw_fishman_district"],
          raceDiscoveries: [{ raceId: "FISH_MAN", sourceId: "fishman_district" }],
        },
      },
    ],
  },
  {
    id: "mink_traveler",
    title: "The Furred Traveler",
    description:
      "A cloaked stranger on the pier has a muzzle, not a jaw. When they pull the hood, you see animal eyes and a spark jumping between two fingers.",
    weight: 4,
    relevantRaces: ["MINK"],
    conditions: [{ type: "PLAYER_FLAG", flag: "met_mink_traveler", negate: true }],
    choices: [
      {
        id: "talk",
        text: "Ask where they are from",
        outcome: {
          text: "They laugh, static popping. 'A country on the back of an elephant, if you can believe it.' Electro crawls their wrist. They mention a moon, and a form they will not show you here. Then they are gone into the crowd.",
          addPlayerFlags: ["met_mink_traveler"],
          raceDiscoveries: [{ raceId: "MINK", sourceId: "mink_traveler" }],
          worldNews: "A mink with living lightning was seen hopping East Blue docks.",
        },
      },
      {
        id: "fight",
        text: "Test them",
        flavour: "Curiosity with fists. They look faster than you.",
        checkStat: "strength",
        risk: "HIGH",
        visual: { variant: "fight" },
        outcome: {
          text: "Curiosity with fists.",
          addPlayerFlags: ["met_mink_traveler"],
          raceDiscoveries: [{ raceId: "MINK", sourceId: "mink_traveler" }],
          combat: {
            enemyName: "Mink Traveler",
            enemyStrength: 8,
            combatKind: "HIGH_RISK",
            canEscape: true,
            win: {
              text: "They yield with a grin and a scorch mark on your sleeve. 'Electro. Remember it.'",
              bountyChange: 200,
            },
            lose: {
              text: "The shock drops you. They help you up anyway. 'We are Minks. Not beasts.'",
              hpChange: -14,
            },
          },
        },
      },
      {
        id: "hide",
        text: "Keep your distance",
        flavour: "Watch, learn, do not pick this fight.",
        checkStat: "speed",
        risk: "LOW",
        visual: { variant: "escape" },
        outcome: {
          text: "You let the crowd swallow you. Animal eyes, a spark between fingers — you will remember the shape even if you never learn the name today.",
          addPlayerFlags: ["met_mink_traveler"],
          raceDiscoveries: [{ raceId: "MINK", sourceId: "mink_traveler_seen" }],
        },
      },
    ],
  },
  {
    id: "mink_moon_story",
    title: "Moon Story",
    description:
      "A sailor who has been to Zou — or claims it — buys your table a drink if you will listen about animal people and a full moon that changes them.",
    weight: 4,
    relevantRaces: ["MINK"],
    conditions: [{ type: "PLAYER_FLAG", flag: "heard_mink_moon", negate: true }],
    choices: [
      {
        id: "listen",
        text: "Listen",
        outcome: {
          text: "Sulong, they say, is not a people. It is what a Mink becomes when the moon is cruel and bright. You file that next to Electro, where it belongs.",
          addPlayerFlags: ["heard_mink_moon"],
          raceDiscoveries: [{ raceId: "MINK", sourceId: "mink_moon_story" }],
        },
      },
      {
        id: "pay",
        text: "Pay for the rest (30 berries)",
        conditions: [{ type: "MIN_BERRIES", value: 30 }],
        outcome: {
          text: "The rest is geography, fear, and a warning not to confuse a transformation with a race. You will not.",
          berriesChange: -30,
          addPlayerFlags: ["heard_mink_moon"],
          raceDiscoveries: [{ raceId: "MINK", sourceId: "mink_moon_story" }],
        },
      },
    ],
  },
  {
    id: "sky_wreckage",
    title: "Wreckage from Above",
    description:
      "White stone that should not float, and a small wing of cartilage, wash against your hull. Someone fell a long way.",
    weight: 4,
    relevantRaces: ["SKY_PERSON"],
    conditions: [{ type: "PLAYER_FLAG", flag: "saw_sky_wreckage", negate: true }],
    choices: [
      {
        id: "study",
        text: "Study the wreckage",
        outcome: {
          text: "Cloud-stone. A wing too small for flight as birds know it. Skypiean script on a snapped railing. Sky People — one race, many islands. Skypiean, Shandian, Birkan: origins, not species.",
          addPlayerFlags: ["saw_sky_wreckage"],
          raceDiscoveries: [{ raceId: "SKY_PERSON", sourceId: "sky_wreckage" }],
          addInventory: [
            {
              id: "sky_island_fragment",
              name: "Sky Island Fragment",
              type: "MATERIAL",
              description: "Cloud-stone that should not exist at sea level.",
            },
          ],
        },
      },
      {
        id: "ignore",
        text: "Let it drift",
        outcome: {
          text: "You still saw the wing. That is enough to know the sky has people in it.",
          addPlayerFlags: ["saw_sky_wreckage"],
          raceDiscoveries: [{ raceId: "SKY_PERSON", sourceId: "sky_wreckage" }],
        },
      },
    ],
  },
  {
    id: "giant_footprint",
    title: "A Step Across the Beach",
    description:
      "The print is longer than your boat. Villagers swear a giant walked the strand at dusk and did not stop for their screaming.",
    weight: 3.5,
    relevantRaces: ["GIANT"],
    conditions: [{ type: "PLAYER_FLAG", flag: "saw_giant_print", negate: true }],
    choices: [
      {
        id: "measure",
        text: "Measure it",
        outcome: {
          text: "Elbaph, they whisper. Not a story. A people who duck for clouds. You take the measure and the rumor both.",
          addPlayerFlags: ["saw_giant_print"],
          raceDiscoveries: [{ raceId: "GIANT", sourceId: "giant_footprint" }],
        },
      },
    ],
  },
  {
    id: "forbidden_archives",
    title: "A Page That Should Not Exist",
    description:
      "A Marine clerk 'loses' a folio behind a crate. The seal is World Government. The heading is a race the papers never print: Lunarian.",
    weight: 2.2,
    conditions: [{ type: "PLAYER_FLAG", flag: "read_lunarian_folio", negate: true }],
    choices: [
      {
        id: "read",
        text: "Read it",
        outcome: {
          text: "Flame along the back. Dark wings. Near extinction. Capture orders, not contact orders. This is not a person you will meet on a dock. This is a hunted history.",
          addPlayerFlags: ["read_lunarian_folio"],
          raceDiscoveries: [{ raceId: "LUNARIAN", sourceId: "forbidden_archives" }],
          addInventory: [
            {
              id: "forbidden_folio",
              name: "Forbidden Folio",
              type: "MISC",
              description: "A World Government record that was never meant to leave a vault.",
            },
          ],
          factionChanges: [
            { factionId: "WORLD_GOVERNMENT", amount: -4, reason: "Read a forbidden Government folio" },
          ],
          worldPowerChanges: { oppression: 1 },
        },
      },
      {
        id: "burn",
        text: "Burn it unread",
        outcome: {
          text: "You burn the heading. The word Lunarian still sits behind your eyes. Some knowledge does not need the rest of the page.",
          addPlayerFlags: ["read_lunarian_folio"],
          raceDiscoveries: [{ raceId: "LUNARIAN", sourceId: "forbidden_archives" }],
        },
      },
    ],
  },
  {
    id: "ancient_mural",
    title: "The Burned Mural",
    description:
      "A sea-cave shrine. Most of the paint is gone. What remains is a winged figure standing in fire, and a Government mark stamped over the face.",
    weight: 1.8,
    conditions: [{ type: "PLAYER_FLAG", flag: "saw_lunarian_mural", negate: true }],
    choices: [
      {
        id: "copy",
        text: "Copy the mural",
        outcome: {
          text: "You sketch what the stamp failed to hide. Another fragment of a people the world is not supposed to remember. No one here has seen a Lunarian. The mural is older than the village.",
          addPlayerFlags: ["saw_lunarian_mural"],
          raceDiscoveries: [{ raceId: "LUNARIAN", sourceId: "ancient_mural" }],
        },
      },
    ],
  },
  {
    id: "marine_fruit_convoy",
    title: "Sealed Marine Crate",
    description:
      "A Marine launch limps into a cove with one crate lashed like it contains a war. The escort is thin. The lock is not.",
    weight: 1.3,
    fruitEncounter: true,
    regions: ALL_SEAS,
    conditions: [
      { type: "ANY_UNCLAIMED_FRUIT" },
      { type: "PLAYER_FLAG", flag: "hit_marine_fruit_convoy", negate: true },
    ],
    bindFruit: "UNCLAIMED",
    choices: [
      {
        id: "steal",
        text: "Hit the convoy",
        outcome: {
          text: "You hit them while they are counting the wounded.",
          addPlayerFlags: ["hit_marine_fruit_convoy"],
          combat: {
            enemyName: "Convoy Marines",
            enemyStrength: 8,
            win: {
              text: "The crate opens on the {fruitName}. Someone was moving power, not grain.",
              devilFruit: { action: "KEEP", fruitId: "BOUND" },
              bountyChange: 1500,
              factionChanges: [
                { factionId: "MARINES", amount: -10, reason: "Robbed a Marine Devil Fruit convoy" },
                { factionId: "WORLD_GOVERNMENT", amount: -6, reason: "Stole Government-held cargo" },
              ],
              worldNews: "Marines lost a sealed crate. The contents were never listed.",
            },
            lose: {
              text: "They keep the crate. You keep the bruises and a new wanted line.",
              hpChange: -24,
              bountyChange: 400,
              factionChanges: [{ factionId: "MARINES", amount: -4, reason: "Attempted to rob a Marine convoy" }],
            },
          },
        },
      },
      {
        id: "leave",
        text: "Let it pass",
        outcome: {
          text: "Some cargo is how eras start. You decide this one can start without you.",
          addPlayerFlags: ["hit_marine_fruit_convoy"],
        },
      },
    ],
  },
  {
    id: "underground_auction",
    title: "Back-Room Auction",
    description:
      "A password, a cellar, a cloth. Bidders who do not show their faces. Tonight's lot is not jewelry.",
    weight: 1.2,
    fruitEncounter: true,
    conditions: [
      { type: "ANY_UNCLAIMED_FRUIT" },
      { type: "MIN_BERRIES", value: 1800 },
      { type: "PLAYER_FLAG", flag: "saw_fruit_auction", negate: true },
    ],
    bindFruit: "UNCLAIMED",
    choices: [
      {
        id: "buy",
        text: "Buy the lot (1800 berries)",
        outcome: {
          text: "The gavel falls. The {fruitName} is yours. So is the attention of everyone who lost.",
          berriesChange: -1800,
          devilFruit: { action: "KEEP", fruitId: "BOUND" },
          addPlayerFlags: ["saw_fruit_auction"],
          bountyChange: 300,
          factionChanges: [{ factionId: "PIRATES", amount: 3, reason: "Bought power at an underworld auction" }],
          worldNews: "A Devil Fruit changed hands in a cellar that does not exist.",
        },
      },
      {
        id: "leave",
        text: "Walk out",
        outcome: {
          text: "You keep your berries and your pulse. The {fruitName} goes to someone hungrier.",
          addPlayerFlags: ["saw_fruit_auction"],
        },
      },
    ],
  },
  {
    id: "pirate_treasure_cache",
    title: "A Captain's Last Cache",
    description:
      "The pirate who died on this rock hid more than coin. The chest has a second bottom, and the second bottom has a smell like a market that should not exist.",
    weight: 1.1,
    fruitEncounter: true,
    conditions: [
      { type: "ANY_UNCLAIMED_FRUIT" },
      { type: "MIN_BOUNTY", value: 1200 },
      { type: "PLAYER_FLAG", flag: "found_pirate_cache", negate: true },
    ],
    bindFruit: "UNCLAIMED",
    choices: [
      {
        id: "open",
        text: "Open the hidden tray",
        outcome: {
          text: "Coin, a rotting map, and the {fruitName}. Rare enough that the dead captain died keeping it.",
          berriesChange: 220,
          devilFruit: { action: "KEEP", fruitId: "BOUND" },
          addPlayerFlags: ["found_pirate_cache"],
          worldNews: "A dead pirate's cache is said to have held a Devil Fruit.",
        },
      },
      {
        id: "leave",
        text: "Take only the coin",
        outcome: {
          text: "You take the obvious purse. The hidden tray stays a superstition.",
          berriesChange: 180,
          addPlayerFlags: ["found_pirate_cache"],
        },
      },
    ],
  },
  {
    id: "stolen_cargo",
    title: "Stolen Hold",
    description:
      "Smugglers dumped a hold and ran. Most of it is spice. One crate is marked with a Government cipher and a skull scratched over it.",
    weight: 1,
    fruitEncounter: true,
    regions: ALL_SEAS,
    conditions: [
      { type: "ANY_UNCLAIMED_FRUIT" },
      { type: "PLAYER_FLAG", flag: "saw_stolen_cargo", negate: true },
    ],
    bindFruit: "UNCLAIMED",
    choices: [
      {
        id: "crack",
        text: "Crack the marked crate",
        outcome: {
          text: "Inside: straw, a swirl-skinned {fruitName}, and a bill of lading that will get someone hanged.",
          devilFruit: { action: "KEEP", fruitId: "BOUND" },
          addPlayerFlags: ["saw_stolen_cargo"],
          bountyChange: 250,
          factionChanges: [
            { factionId: "WORLD_GOVERNMENT", amount: -5, reason: "Took stolen Government cargo" },
          ],
        },
      },
      {
        id: "leave",
        text: "Leave the ciphered crate",
        outcome: {
          text: "You take spice. History can keep the rest.",
          berriesChange: 90,
          addPlayerFlags: ["saw_stolen_cargo"],
        },
      },
    ],
  },
  {
    id: "devil_fruit_rumor",
    title: "Fruit Rumor",
    description:
      "A broker leans in with a drawing: swirl, stem, a price that is not a price. They have not seen the fruit. They have seen the kind of men who hunt it.",
    weight: 2.4,
    fruitEncounter: true,
    conditions: [{ type: "PLAYER_FLAG", flag: "heard_fruit_rumor", negate: true }],
    choices: [
      {
        id: "pay",
        text: "Pay for the chart (80 berries)",
        conditions: [{ type: "MIN_BERRIES", value: 80 }],
        outcome: {
          text: "The chart is half lie. The hunger it plants is real. Devil Fruits are not flotsam. They move through vaults, auctions, and dead captains.",
          berriesChange: -80,
          addPlayerFlags: ["heard_fruit_rumor"],
          worldNews: "Rumor of a Devil Fruit has the East Blue underworld drawing maps.",
        },
      },
      {
        id: "leave",
        text: "Refuse",
        outcome: {
          text: "You walk. The drawing still follows you home.",
          addPlayerFlags: ["heard_fruit_rumor"],
        },
      },
    ],
  },
  {
    id: "heavenly_tribute",
    title: "Heavenly Tribute",
    description:
      "World Government agents, not Marines, count sacks on a dock. The island will eat less so someone far away can eat more.",
    weight: 5,
    conditions: [{ type: "PLAYER_FLAG", flag: "saw_tribute", negate: true }],
    choices: [
      {
        id: "interfere",
        text: "Interfere",
        outcome: {
          text: "You spill a ledger and a sack. The agents do not shout. They write.",
          addPlayerFlags: ["saw_tribute"],
          bountyChange: 600,
          factionChanges: [
            { factionId: "WORLD_GOVERNMENT", amount: -12, reason: "Interfered with Heavenly Tribute" },
            { factionId: "MARINES", amount: -2, reason: "Blocked a Government collection" },
          ],
          worldPowerChanges: { oppression: 3, revolutionaryActivity: 4, worldGovernmentPower: 1 },
          worldNews: "Tribute collection was disrupted on a minor East Blue island.",
        },
      },
      {
        id: "watch",
        text: "Watch",
        outcome: {
          text: "You watch an island get thinner. Marines look away. Government clerks do not.",
          addPlayerFlags: ["saw_tribute"],
          factionChanges: [{ factionId: "WORLD_GOVERNMENT", amount: 2, reason: "Did not interfere with tribute" }],
          worldPowerChanges: { oppression: 4, worldGovernmentPower: 2, revolutionaryActivity: 2 },
        },
      },
    ],
  },
  {
    id: "west_current",
    title: "A Chart of Another Blue",
    description:
      "A drunk navigator slaps a stained chart on your table. West Blue currents, marked in a hand that has been there.",
    weight: 3,
    conditions: [{ type: "PLAYER_FLAG", flag: "got_west_chart", negate: true }],
    choices: [
      {
        id: "take",
        text: "Take the chart",
        outcome: {
          text: "You can start a future run from a West Blue port — if you live long enough to want to.",
          addPlayerFlags: ["got_west_chart"],
          unlockLocation: "west_blue_port",
        },
      },
      {
        id: "leave",
        text: "Leave it",
        outcome: {
          text: "You already have a sea. You do not need another yet.",
          addPlayerFlags: ["got_west_chart"],
        },
      },
    ],
  },
  {
    id: "reverse_mountain",
    title: "The Mountain That Climbs",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png" },
    timeCost: "DAY",
    description:
      "A current that should not exist. Knock-Up? No — Reverse Mountain, if the stories are true. The Grand Line is a mouth at the top.",
    weight: 2,
    conditions: [
      { type: "MIN_BOUNTY", value: 4000 },
      { type: "PLAYER_FLAG", flag: "tried_reverse_mountain", negate: true },
    ],
    choices: [
      {
        id: "climb",
        text: "Ride the current",
        outcome: {
          text: "You climb a river up a mountain. Compasses die. The Grand Line opens like a dare.",
          addPlayerFlags: ["tried_reverse_mountain"],
          addRunFlags: ["reached_grand_line"],
          addMilestones: ["reached_grand_line"],
          moveToLocation: "grand_line_entrance",
          unlockLocation: "grand_line_entrance",
          worldNews: "{playerName} is rumored to have entered the Grand Line.",
        },
      },
      {
        id: "turn",
        text: "Turn back",
        outcome: {
          text: "Paradise can wait. The East Blue still has teeth enough.",
          addPlayerFlags: ["tried_reverse_mountain"],
        },
      },
    ],
  },
  {
    id: "revolutionary_cell",
    title: "A Fire in the Back Room",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png" },
    description:
      "The tavern's back room smells of oil and cheap pamphlets. People who are not pirates and not Marines talk about emptying thrones.",
    weight: 7,
    conditions: [
      { type: "FACTION_DISCOVERED", factionId: "REVOLUTIONARY_ARMY" },
      { type: "PLAYER_FLAG", flag: "met_revolutionary_cell", negate: true },
    ],
    choices: [
      {
        id: "listen",
        text: "Listen",
        outcome: {
          text: "They do not recruit you. They measure you. The Revolutionary Army is no longer a rumor in your life.",
          addPlayerFlags: ["met_revolutionary_cell"],
          factionChanges: [
            { factionId: "REVOLUTIONARY_ARMY", amount: 8, reason: "Heard a Revolutionary cell out" },
            { factionId: "WORLD_GOVERNMENT", amount: -3, reason: "Sat with enemies of the Government" },
          ],
        },
      },
      {
        id: "report",
        text: "Walk out and remember faces",
        outcome: {
          text: "You leave. Someone in a white suit would pay for those faces. You have not decided if you are that someone.",
          addPlayerFlags: ["met_revolutionary_cell"],
          factionChanges: [
            { factionId: "REVOLUTIONARY_ARMY", amount: -6, reason: "Refused a Revolutionary cell" },
          ],
        },
      },
    ],
  },
  {
    id: "training_grounds",
    title: "A Place to Train",
    category: "Training",
    visual: { overlay: "DARK", background: "/backgrounds/city.png" },
    timeCost: "LONG",
    description:
      "A dockside yard has posts, sand, and people who will take your coin to make you hurt usefully. Nothing here is free, and nothing here lasts past sundown.",
    weight: 9,
    conditions: [
      {
        type: "ANY_LOCATION",
        locationIds: ["east_blue_port", "south_blue_port", "west_blue_port", "north_blue_port"],
      },
    ],
    choices: [
      {
        id: "strength",
        text: "Work the dojo",
        flavour: "Posts, sacks, and a trainer who does not care what you call yourself.",
        checkStat: "strength",
        costLabel: "Time · 20 berries · bruise",
        timeCost: "LONG",
        visual: {
          icon: "gain_strength",
          backgroundVariant: "dojo",
          accent: "strength",
          variant: "train",
        },
        conditions: [{ type: "MIN_BERRIES", value: 20 }],
        outcome: {
          text: "You hit wood until your shoulders answer.",
          berriesChange: -20,
          hpChange: -4,
          trainStat: "strength",
        },
      },
      {
        id: "defense",
        text: "Guard drills",
        flavour: "A retired marine runs the same shield forms until your arms shake.",
        checkStat: "defense",
        costLabel: "Time · 20 berries · bruise",
        timeCost: "LONG",
        visual: {
          icon: "gain_defense",
          backgroundVariant: "harbor-drills",
          accent: "defense",
          variant: "train",
        },
        conditions: [{ type: "MIN_BERRIES", value: 20 }],
        outcome: {
          text: "You learn how to be a wall for a few breaths longer.",
          berriesChange: -20,
          hpChange: -3,
          trainStat: "defense",
        },
      },
      {
        id: "speed",
        text: "Ship work and sprints",
        flavour: "Ropes, rails, and a race along the quay before the watch shouts.",
        checkStat: "speed",
        costLabel: "Time · 15 berries",
        timeCost: "LONG",
        visual: {
          icon: "gain_speed",
          backgroundVariant: "ship-deck",
          accent: "speed",
          variant: "train",
        },
        conditions: [{ type: "MIN_BERRIES", value: 15 }],
        outcome: {
          text: "You run until the docks blur.",
          berriesChange: -15,
          hpChange: -3,
          trainStat: "speed",
        },
      },
      {
        id: "willpower",
        text: "Meditate on the bluff",
        flavour: "Sit still. Count the tide. Do not get up when it gets ugly.",
        checkStat: "willpower",
        costLabel: "Time",
        timeCost: "LONG",
        visual: {
          icon: "gain_willpower",
          backgroundVariant: "moonlit-bluff",
          accent: "willpower",
          variant: "train",
        },
        outcome: {
          text: "The wind tries to hurry you. You do not hurry.",
          hpChange: -2,
          trainStat: "willpower",
        },
      },
      {
        id: "charisma",
        text: "Talk the tavern down",
        flavour: "A packed room, a bad joke, and a chance to hold the room anyway.",
        checkStat: "charisma",
        costLabel: "Time · 15 berries",
        timeCost: "LONG",
        visual: {
          icon: "gain_charisma",
          backgroundVariant: "tavern",
          accent: "charisma",
          variant: "parley",
        },
        conditions: [{ type: "MIN_BERRIES", value: 15 }],
        outcome: {
          text: "You buy a round and keep the room. Or you do not.",
          berriesChange: -15,
          trainStat: "charisma",
        },
      },
      {
        id: "intelligence",
        text: "Study the charts",
        flavour: "Maps, tide tables, and a quiet corner where guessing is expensive.",
        checkStat: "intelligence",
        costLabel: "Time · 15 berries",
        timeCost: "LONG",
        visual: {
          icon: "gain_intelligence",
          backgroundVariant: "chart-room",
          accent: "intelligence",
          variant: "train",
        },
        conditions: [{ type: "MIN_BERRIES", value: 15 }],
        outcome: {
          text: "You trace currents until the pattern sticks.",
          berriesChange: -15,
          hpChange: -2,
          trainStat: "intelligence",
        },
      },
    ],
  },
  {
    id: "beach_sprints",
    title: "Tide-Line Sprints",
    category: "Training",
    visual: { overlay: "SEA", background: "/backgrounds/beach.png" },
    timeCost: "LONG",
    description:
      "The beach is empty enough to hurt yourself without an audience. Wet sand eats speed. That is the point.",
    weight: 6,
    choices: [
      {
        id: "sprint",
        text: "Sprint the tide line",
        flavour: "Down to the rocks and back until your lungs argue.",
        checkStat: "speed",
        costLabel: "Time · fatigue",
        timeCost: "LONG",
        visual: { variant: "train", icon: "gain_speed", accent: "speed", backgroundVariant: "beach" },
        outcome: {
          text: "Sand, spray, and the ugly math of staying fast.",
          hpChange: -5,
          trainStat: "speed",
        },
      },
      {
        id: "labor",
        text: "Haul wreckage",
        flavour: "Beached timber does not move itself.",
        checkStat: "strength",
        costLabel: "Time · fatigue",
        timeCost: "LONG",
        visual: { variant: "train", icon: "gain_strength", accent: "strength", backgroundVariant: "beach" },
        outcome: {
          text: "You drag what the sea discarded until your hands stop pretending they are fine.",
          hpChange: -6,
          trainStat: "strength",
        },
      },
      {
        id: "leave",
        text: "Keep walking",
        timeCost: "BRIEF",
        visual: { icon: "keep-distance", backgroundVariant: "beach" },
        presentation: { primaryLabel: "LEAVE" },
        outcome: {
          text: "You leave the beach to people who like pain more than you do today.",
        },
      },
    ],
  },
  {
    id: "shipboard_drills",
    title: "Work the Deck",
    category: "Training",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png" },
    timeCost: "LONG",
    description:
      "Open water and nothing to do but the work you have been putting off. The ship will take whatever you give it.",
    weight: 5,
    regions: ALL_SEAS,
    choices: [
      {
        id: "guard",
        text: "Brace and hold",
        flavour: "Stand the rail. Take the roll. Do not fall.",
        checkStat: "defense",
        costLabel: "Time",
        timeCost: "LONG",
        visual: { icon: "gain_defense", accent: "defense", backgroundVariant: "ship-deck", variant: "train" },
        outcome: {
          text: "You practice being harder to move than the deck wants.",
          hpChange: -3,
          trainStat: "defense",
        },
      },
      {
        id: "watch",
        text: "Stand a long watch",
        flavour: "Eyes on the horizon until they water.",
        checkStat: "willpower",
        costLabel: "Time",
        timeCost: "LONG",
        visual: { icon: "gain_willpower", accent: "willpower", backgroundVariant: "ship-deck", variant: "train" },
        outcome: {
          text: "Night, then grey, then the same line of sea. You stay.",
          trainStat: "willpower",
        },
      },
      {
        id: "leave",
        text: "Let the day pass",
        timeCost: "SLOT",
        visual: { icon: "rest", backgroundVariant: "ship-deck" },
        presentation: { primaryLabel: "REST" },
        outcome: {
          text: "You do the minimum and keep your strength for later trouble.",
        },
      },
    ],
  },
  ...EXTENDED_ENCOUNTERS,
];

export function getEncounterById(id: string): Encounter | undefined {
  return ENCOUNTERS.find((encounter) => encounter.id === id);
}
