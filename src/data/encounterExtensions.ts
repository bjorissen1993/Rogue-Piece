import type { Encounter } from "../models/types";

/** Additional encounters for story progression, variety, and new systems. */
export const EXTENDED_ENCOUNTERS: Encounter[] = [
  {
    id: "dockside_gossip",
    title: "Dockside Gossip",
    category: "SOCIAL",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "Sailors swap rumors over cheap ale. Someone mentions a crew with red-painted fangs on their flag.",
    weight: 11,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "listen",
        text: "Listen closely",
        checkStat: "charisma",
        outcome: {
          text: "The Red Fang Pirates have been raiding merchant lanes. A rivalry waiting to happen.",
          startStoryThread: "red_fang_rivalry",
          addRunFlags: ["heard_red_fang"],
          createNpc: {
            id: "npc_red_fang_kuroto",
            name: "Kuroto",
            epithet: "Red Fang",
            faction: "PIRATE",
            strength: 8,
            bounty: 12000,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: -1,
            tags: ["red_fang", "rival"],
            importance: 4,
            personality: "Proud and theatrical",
            goals: ["Dominate East Blue trade routes"],
            combatStyle: "swordsmanship",
            weaponIds: ["captain_saber"],
          },
          statChanges: { charisma: 1 },
        },
      },
      {
        id: "ignore",
        text: "Finish your drink",
        outcome: { text: "Rumors are cheap. You have your own course to plot." },
      },
    ],
  },
  {
    id: "red_fang_sighting",
    title: "Red Fang on the Horizon",
    category: "STORY",
    tier: "MID",
    storyThreadTemplateId: "red_fang_rivalry",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png", variant: "fight" },
    description:
      "A crimson fang flag unfurls on a fast sloop. Captain Kuroto \"Red Fang\" grins from the rail — he has heard of you too.",
    weight: 14,
    conditions: [{ type: "STORY_THREAD", templateId: "red_fang_rivalry", minStage: 0, state: "DISCOVERED" }],
    bindCharacterId: "npc_red_fang_kuroto",
    choices: [
      {
        id: "challenge",
        text: "Challenge them",
        outcome: {
          text: "Red Fang answers with steel. The rivalry is no longer rumor.",
          advanceStoryThread: "red_fang_rivalry",
          createNpc: {
            id: "npc_red_fang_kuroto",
            name: "Kuroto",
            epithet: "Red Fang",
            faction: "PIRATE",
            strength: 8,
            bounty: 12000,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: -2,
            tags: ["red_fang", "rival", "known_to_player"],
            importance: 4,
            personality: "Proud and theatrical",
            goals: ["Dominate East Blue trade routes"],
            combatStyle: "swordsmanship",
            weaponIds: ["captain_saber"],
          },
          recordFirstMeeting: { characterId: "npc_red_fang_kuroto" },
          combat: {
            enemyName: "Kuroto \"Red Fang\"",
            enemyStrength: 8,
            combatKind: "DUEL",
            enemyRole: "ELITE",
            enemyFamily: "PIRATE",
            battleFormat: {
              id: "DUEL_1V1",
              minPlayerFighters: 1,
              maxPlayerFighters: 1,
              minEnemies: 1,
              maxEnemies: 1,
              playerChoosesParticipants: true,
              allowCaptainSitOut: true,
              isFriendly: false,
              stakesAllowed: false,
              label: "Duel · 1 vs 1",
            },
            requireSetup: true,
            enemyCount: 1,
            canEscape: true,
            win: {
              text: "Red Fang retreats with a bloody grin. \"Next time, captain!\"",
              bountyChange: 1500,
              addCharacterMemory: { characterId: "npc_red_fang_kuroto", type: "FOUGHT", importance: 2 },
              advanceStoryThread: "red_fang_rivalry",
              setWorldProgressionFlag: "first_rival",
            },
            lose: {
              text: "He leaves you gasping on your deck. The fang flag fades into spray.",
              hpChange: -18,
              failStoryThread: "red_fang_rivalry",
            },
          },
        },
      },
      {
        id: "parley",
        text: "Call out for parley",
        outcome: {
          text: "Kuroto laughs. \"Smart. For now.\" The Red Fang vanishes east — but they'll be back.",
          advanceStoryThread: "red_fang_rivalry",
          factionChanges: [{ factionId: "PIRATES", amount: 1, reason: "Parley with Red Fang" }],
        },
      },
    ],
  },
  {
    id: "red_fang_ambush",
    title: "Red Fang Ambush",
    category: "STORY",
    tier: "MID",
    storyThreadTemplateId: "red_fang_rivalry",
    visual: { overlay: "SEA", background: "/backgrounds/battle.png", variant: "fight" },
    description:
      "Smoke bombs. Boarding hooks. The Red Fang crew wants a rematch — Kuroto is done being polite.",
    weight: 16,
    conditions: [{ type: "STORY_THREAD", templateId: "red_fang_rivalry", minStage: 1 }],
    bindNpcTags: ["red_fang"],
    choices: [
      {
        id: "fight",
        text: "Fight them off",
        outcome: {
          text: "Deck planks turn slick with blood and seawater.",
          advanceStoryThread: "red_fang_rivalry",
          combat: {
            enemyName: "Red Fang Boarders",
            enemyStrength: 9,
            combatKind: "HIGH_RISK",
            canEscape: true,
            win: {
              text: "You repel the boarders. Kuroto's voice carries over the water: \"Soon!\"",
              bountyChange: 2000,
              berriesChange: 300,
              bumpCharacterImportance: { characterId: "npc_red_fang_kuroto", amount: 1 },
            },
            lose: { text: "They take a crate and your pride.", hpChange: -24, berriesChange: -150 },
          },
        },
      },
      {
        id: "flee",
        text: "Cut the ropes and run",
        outcome: {
          text: "You leave the Red Fang chewing your wake. Living to fight later counts.",
          skillCheck: {
            stat: "speed",
            difficulty: 9,
            success: { text: "Clean escape. Kuroto's curses fade behind the swell." },
            failure: { text: "A parting shot tears your sail.", hpChange: -10 },
          },
        },
      },
    ],
  },
  {
    id: "red_fang_showdown",
    title: "Showdown with Red Fang",
    category: "STORY",
    tier: "LATE",
    storyThreadTemplateId: "red_fang_rivalry",
    visual: { overlay: "FIRE", background: "/backgrounds/battle.png", variant: "fight" },
    description:
      "At a narrow strait both captains have been steering toward for days, Red Fang blocks the channel. Kuroto draws his saber. \"One of us leaves a legend today.\"",
    weight: 18,
    conditions: [{ type: "STORY_THREAD", templateId: "red_fang_rivalry", minStage: 2 }],
    bindNpcTags: ["red_fang"],
    choices: [
      {
        id: "duel",
        text: "Accept the duel",
        outcome: {
          text: "Steel rings. Crews watch from both rails.",
          combat: {
            enemyName: "Kuroto \"Red Fang\"",
            enemyStrength: 11,
            combatKind: "STORY",
            canEscape: false,
            unescapableReason: "Kuroto has blocked the channel — someone breaks today.",
            win: {
              text: "Red Fang falls to his knees, saber cracked. \"Take the strait, captain. You earned it.\" His crew disperses into the mist.",
              bountyChange: 5000,
              resolveStoryThread: "red_fang_rivalry",
              worldNews: "{playerName} defeated the Red Fang Pirates in a channel duel.",
              factionChanges: [
                { factionId: "PIRATES", amount: 5, reason: "Defeated a notorious rival" },
                { factionId: "MARINES", amount: -2, reason: "Raised profile with a public duel" },
              ],
            },
            lose: {
              text: "The sea claims your pride. Kuroto lets you limp away — a mercy that feels worse than death.",
              hpChange: -30,
              failStoryThread: "red_fang_rivalry",
            },
          },
        },
      },
      {
        id: "crew",
        text: "Overwhelm with numbers",
        conditions: [{ type: "CREW_MIN", value: 1 }],
        outcome: {
          text: "Your crew swarms the Red Fang. Kuroto curses your tactics but yields the strait.",
          resolveStoryThread: "red_fang_rivalry",
          bountyChange: 3500,
        },
      },
    ],
  },
  {
    id: "bounty_hunter_milo_tip",
    title: "A Hunter's Tip",
    category: "FACTION",
    tier: "EARLY",
    visual: { overlay: "SHADOW", background: "/backgrounds/tavern.png" },
    description:
      "A lanky man in a wide hat slides a poster toward you. \"Milo,\" he says. \"Bounty hunter. He hunts captains, not berries.\"",
    weight: 9,
    choices: [
      {
        id: "ask",
        text: "Ask about Milo",
        outcome: {
          text: "Milo takes contracts from Marines and pirates alike. He is already asking about you.",
          startStoryThread: "bounty_hunter_milo",
          addRunFlags: ["knows_milo"],
        },
      },
      { id: "leave", text: "Leave the poster", outcome: { text: "Some names are better left unread." } },
    ],
  },
  {
    id: "milo_pursuit",
    title: "Milo Closes In",
    category: "STORY",
    tier: "MID",
    storyThreadTemplateId: "bounty_hunter_milo",
    visual: { overlay: "DARK", background: "/backgrounds/jungle.png", variant: "fight" },
    description: "Milo steps from the treeline, rifles leveled. \"{playerName}. My contract mentions you specifically.\"",
    weight: 12,
    conditions: [{ type: "STORY_THREAD", templateId: "bounty_hunter_milo", minStage: 0 }],
    choices: [
      {
        id: "fight",
        text: "Fight",
        outcome: {
          text: "Milo fights like a man who has never missed a payday.",
          advanceStoryThread: "bounty_hunter_milo",
          createNpc: {
            id: "npc_milo",
            name: "Milo",
            faction: "CIVILIAN",
            strength: 7,
            bounty: 0,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: -3,
            tags: ["bounty_hunter", "milo"],
            importance: 3,
            personality: "Cold and professional",
          },
          combat: {
            enemyName: "Bounty Hunter Milo",
            enemyStrength: 7,
            win: {
              text: "Milo retreats with a nod of respect. \"You're worth more alive — for now.\"",
              resolveStoryThread: "bounty_hunter_milo",
              bountyChange: 1000,
            },
            lose: { text: "He takes a cut of your purse and your dignity.", hpChange: -20, berriesChange: -200 },
          },
        },
      },
      {
        id: "bribe",
        text: "Pay him off",
        conditions: [{ type: "MIN_BERRIES", value: 300 }],
        outcome: {
          text: "Milo counts the coins. \"Smart captain.\" He vanishes before dawn.",
          berriesChange: -300,
          resolveStoryThread: "bounty_hunter_milo",
        },
      },
    ],
  },
  {
    id: "crew_recruit_offer",
    title: "Sailor Wants Out",
    category: "CREW",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png", variant: "help" },
    description:
      "A dockworker with rope-burned hands watches your ship. \"I know rigging, knots, and when to keep my mouth shut.\"",
    weight: 10,
    choices: [
      {
        id: "hire",
        text: "Take them aboard",
        outcome: {
          text: "Ren joins as navigator-in-training. The crew feels less empty.",
          createNpc: {
            id: "npc_ren_nav",
            name: "Ren",
            faction: "CIVILIAN",
            strength: 4,
            bounty: 0,
            devilFruitId: null,
            alive: true,
            relationshipWithPlayer: 2,
            tags: ["crew_candidate", "navigator"],
            joinInterest: 80,
            crewRole: "NAVIGATOR",
            recruitmentPath: "friendship",
          },
          acceptRecruitment: { characterId: "npc_ren_nav", role: "NAVIGATOR", membership: "ALLY" },
        },
      },
      {
        id: "decline",
        text: "Not today",
        outcome: { text: "Ren nods and fades back into the dock crowd." },
      },
    ],
  },
  {
    id: "wants_to_join",
    title: "An Old Acquaintance Returns",
    category: "CREW",
    tier: "MID",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png" },
    description:
      "{npcName} finds you at a tavern. \"I've been thinking,\" they say. \"Your crew could use someone like me.\"",
    weight: 8,
    conditions: [{ type: "NPC_TAGS", tags: ["known_to_player"] }],
    bindNpcTags: ["known_to_player"],
    choices: [
      {
        id: "accept",
        text: "Welcome aboard",
        outcome: {
          text: "{npcName} grins and raises a glass. \"To new seas.\"",
          acceptRecruitment: { role: "FIGHTER", membership: "PERMANENT" },
          modifyJoinInterest: { amount: 100 },
        },
      },
      {
        id: "later",
        text: "Maybe later",
        outcome: {
          text: "{npcName} shrugs. \"The offer stands.\"",
          modifyJoinInterest: { amount: -10 },
        },
      },
    ],
  },
  {
    id: "weapon_smith",
    title: "Island Arms Market",
    category: "EXPLORATION",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description:
      "A weapon shop opens onto the street — racks of blades, poles, and pistols under a soot-stained awning. Browse carefully; stock here sticks around for a few days.",
    weight: 9,
    choices: [
      {
        id: "leave",
        text: "Leave the shop",
        outcome: { text: "You step back into the street, purse and pack unchanged." },
      },
    ],
  },
  {
    id: "sword_trainer",
    title: "Old Swordsman",
    category: "TRAINING",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/training-dojo.png", variant: "train" },
    description:
      "A scarred instructor drills recruits in a wooden yard. \"You hold a blade like a sailor,\" he says. \"Fix that, and I'll teach you something real.\"",
    weight: 8,
    choices: [
      {
        id: "train",
        text: "Train swordsmanship",
        costLabel: "Cost: 1 slot",
        outcome: {
          text: "Hours of footwork and edge control. Your cuts feel cleaner.",
          unlockFightingStyle: "swordsmanship",
          statChanges: { strength: 1 },
          trainStat: "strength",
        },
      },
      { id: "skip", text: "Not today", outcome: { text: "The old man returns to his students." } },
    ],
  },
  {
    id: "black_leg_trainer",
    title: "Chef's Challenge",
    category: "TRAINING",
    tier: "MID",
    visual: { overlay: "LIGHT", background: "/backgrounds/beach.png", variant: "train" },
    description:
      "A kicking chef demolishes crates on the beach. \"Legs are a weapon too. Show me you won't snap the first time you miss.\"",
    weight: 7,
    choices: [
      {
        id: "learn",
        text: "Learn Black Leg basics",
        outcome: {
          text: "Your shins ache for days. Worth it.",
          unlockFightingStyle: "black_leg",
          statChanges: { speed: 1 },
        },
      },
      { id: "watch", text: "Watch only", outcome: { text: "You memorize the rhythm. Maybe next time." } },
    ],
  },
  {
    id: "sea_mirage",
    title: "Sea Mirage",
    category: "WEIRD",
    tier: "MID",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png" },
    description:
      "The horizon doubles. A second sun hangs where no sun should be. Old sailors cross themselves.",
    weight: 6,
    choices: [
      {
        id: "sail",
        text: "Sail toward it",
        outcome: {
          text: "The mirage dissolves into laughing gulls and a pod of whales. You feel oddly refreshed.",
          hpChange: 12,
          statChanges: { willpower: 1 },
        },
      },
      {
        id: "avoid",
        text: "Steer clear",
        outcome: { text: "Superstition wins. The sea keeps its impossible secrets." },
      },
    ],
  },
  {
    id: "giant_seagull",
    title: "Giant Seagull",
    category: "WEIRD",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/sea.png" },
    description:
      "A seagull the size of a dinghy lands on your mast. It looks at you like you owe it money.",
    weight: 7,
    choices: [
      {
        id: "feed",
        text: "Feed it dried meat",
        conditions: [{ type: "MIN_BERRIES", value: 0 }],
        outcome: {
          text: "It gulps the meat, squawks once, and drops a shiny button worth more than the meal.",
          berriesChange: 90,
        },
      },
      {
        id: "shoo",
        text: "Shoo it away",
        outcome: {
          text: "Wingbeats knock hats off decks. It leaves offended.",
          skillCheck: {
            stat: "willpower",
            difficulty: 7,
            success: { text: "It lifts off without tipping the mast." },
            failure: { text: "It steals your hat.", hpChange: -4 },
          },
        },
      },
    ],
  },
  {
    id: "marine_recruitment_pitch",
    title: "Marine Recruitment",
    category: "FACTION",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "A Marine officer offers papers — enlistment, steady pay, and a chance to \"serve justice.\" Rank: Recruit. Benefits: barracks, pay, orders. Costs: duty, and leaving later will not be clean.",
    weight: 8,
    conditions: [
      { type: "MEMBERSHIP_STATUS", statuses: ["INDEPENDENT", "FORMER_MEMBER"] },
      { type: "PLAYER_AFFILIATION", factionId: "MARINES", negate: true },
    ],
    choices: [
      {
        id: "enlist",
        text: "Enlist as Recruit",
        flavour: "Sign the papers. Accept the white and blue.",
        presentation: { primaryLabel: "Join Marines", riskLevel: "FAIR" },
        outcome: {
          text: "The seal stamps wet on the page. You are Marine Recruit — justice has a new name on its roster.",
          joinFaction: {
            factionId: "MARINES",
            rankId: "marine_recruit",
            asProspect: true,
            note: "Enlisted via recruitment pitch",
          },
          factionChanges: [
            { factionId: "MARINES", amount: 10, reason: "Enlisted" },
            { factionId: "PIRATES", amount: -4, reason: "Joined Marines" },
          ],
          grantExperience: 15,
          addMilestones: ["joined_marines"],
          worldNews: "{playerName} enlisted with the Marines.",
        },
      },
      {
        id: "decline",
        text: "Decline politely",
        outcome: {
          text: "The officer marks your name as \"declined\" and moves on.",
          factionChanges: [{ factionId: "MARINES", amount: 1, reason: "Polite refusal" }],
          offerFactionRecruitment: {
            factionId: "MARINES",
            rankId: "marine_recruit",
            source: "marine_recruitment_pitch",
            benefits: ["Barracks access", "Steady pay", "Marine standing"],
            consequences: ["Orders bind you", "Desertion brands you"],
          },
        },
      },
      {
        id: "mock",
        text: "Mock the offer",
        outcome: {
          text: "Laughter spreads through the dock. The officer's smile dies.",
          factionChanges: [
            { factionId: "MARINES", amount: -4, reason: "Mocked recruitment" },
            { factionId: "PIRATES", amount: 2, reason: "Public defiance" },
          ],
        },
      },
    ],
  },
  {
    id: "marine_moral_order",
    title: "Orders from Command",
    category: "FACTION",
    tier: "MID",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "A sealed order: detain a dockside smuggler who has been feeding hungry villages. Justice — or mercy?",
    weight: 7,
    conditions: [
      { type: "PLAYER_AFFILIATION", factionId: "MARINES" },
      { type: "MEMBERSHIP_STATUS", statuses: ["PROSPECT", "MEMBER", "OFFICER", "HIGH_RANK"] },
    ],
    choices: [
      {
        id: "obey",
        text: "Arrest them as ordered",
        flavour: "Duty first. The law is the law.",
        outcome: {
          text: "Chains click shut. Command praises your resolve — the villages go hungrier.",
          issueFactionOrder: {
            title: "Detain the village smuggler",
            description: "Arrest a smuggler accused of feeding illegal goods to civilians.",
            factionId: "MARINES",
            moralConflict: true,
          },
          completeFactionOrder: { success: true },
          adjustInternalReputation: 10,
          adjustLoyalty: 5,
          factionChanges: [
            { factionId: "MARINES", amount: 6, reason: "Obeyed difficult order" },
            { factionId: "CIVILIANS", amount: -5, reason: "Arrested a village benefactor" },
          ],
          grantExperience: 18,
        },
      },
      {
        id: "refuse",
        text: "Refuse the order",
        flavour: "Some chains should stay open.",
        risk: "MODERATE",
        outcome: {
          text: "You tear the seal. The smuggler vanishes into the alleys. Your superiors will not forget.",
          issueFactionOrder: {
            title: "Detain the village smuggler",
            description: "Arrest a smuggler accused of feeding illegal goods to civilians.",
            factionId: "MARINES",
            moralConflict: true,
          },
          completeFactionOrder: { success: false },
          adjustInternalReputation: -8,
          adjustLoyalty: -15,
          factionChanges: [
            { factionId: "MARINES", amount: -10, reason: "Refused direct order" },
            { factionId: "CIVILIANS", amount: 6, reason: "Protected a village smuggler" },
          ],
          grantExperience: 12,
        },
      },
      {
        id: "warn",
        text: "Warn them, then report \"escaped\"",
        risk: "HIGH",
        checkStat: "willpower",
        outcome: {
          text: "A quiet tip, a clumsy report. You sleep poorly — but you sleep free of their screams.",
          skillCheck: {
            stat: "willpower",
            difficulty: 8,
            success: {
              text: "Your lie holds. Merit dips; conscience does not.",
              adjustInternalReputation: -3,
              adjustLoyalty: -8,
              factionChanges: [
                { factionId: "MARINES", amount: -3, reason: "Suspicious report" },
                { factionId: "CIVILIANS", amount: 4, reason: "Quiet mercy" },
              ],
              grantExperience: 20,
            },
            failure: {
              text: "A clerk catches the inconsistency. You are reprimanded.",
              demoteRank: true,
              adjustLoyalty: -12,
              factionChanges: [{ factionId: "MARINES", amount: -8, reason: "Falsified report" }],
            },
          },
        },
      },
    ],
  },
  {
    id: "declare_pirate_flag",
    title: "Raise Your Flag",
    category: "FACTION",
    tier: "EARLY",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png", variant: "default" },
    description:
      "Your companions look to you. A Jolly Roger waits — blank cloth, waiting for a name. Declaring piracy is a choice, not a default.",
    weight: 6,
    conditions: [
      { type: "MEMBERSHIP_STATUS", statuses: ["INDEPENDENT", "FORMER_MEMBER"] },
      { type: "PLAYER_AFFILIATION", factionId: "PIRATES", negate: true },
      { type: "CREW_MIN", value: 1 },
    ],
    choices: [
      {
        id: "raise",
        text: "Raise the pirate flag",
        flavour: "No more pretending. The sea will know your crew.",
        presentation: { primaryLabel: "Declare Piracy", riskLevel: "RISKY" },
        outcome: {
          text: "The flag snaps in the wind. You are pirates now — bounty and freedom in the same breath.",
          joinFaction: {
            factionId: "PIRATES",
            rankId: "pirate_captain",
            note: "Raised the flag",
          },
          bountyChange: 1000,
          factionChanges: [
            { factionId: "PIRATES", amount: 12, reason: "Declared piracy" },
            { factionId: "MARINES", amount: -8, reason: "Raised a pirate flag" },
          ],
          grantExperience: 20,
          addMilestones: ["declared_pirate"],
          addRunFlags: ["declared_pirate"],
          worldNews: "{playerName} has raised a pirate flag.",
        },
      },
      {
        id: "wait",
        text: "Keep sailing without a banner",
        outcome: {
          text: "You fold the cloth away. A crew is not yet a pirate crew — and that is fine.",
          grantExperience: 5,
        },
      },
    ],
  },
  {
    id: "revolutionary_whisper",
    title: "A Whisper of Revolution",
    category: "FACTION",
    tier: "MID",
    visual: { overlay: "SHADOW", background: "/backgrounds/alley.png", variant: "parley" },
    description:
      "A hooded contact speaks of broken chains and a hidden army. An offer — not yet a demand.",
    weight: 5,
    conditions: [
      { type: "MEMBERSHIP_STATUS", statuses: ["INDEPENDENT", "FORMER_MEMBER"] },
      { type: "FACTION_DISCOVERED", factionId: "REVOLUTIONARY_ARMY" },
      { type: "PLAYER_AFFILIATION", factionId: "REVOLUTIONARY_ARMY", negate: true },
    ],
    choices: [
      {
        id: "join_cell",
        text: "Join as Sympathizer",
        outcome: {
          text: "A cipher is pressed into your palm. You are a Revolutionary Sympathizer now.",
          joinFaction: {
            factionId: "REVOLUTIONARY_ARMY",
            rankId: "rev_sympathizer",
            asProspect: true,
            note: "Joined via whisper contact",
          },
          factionChanges: [
            { factionId: "REVOLUTIONARY_ARMY", amount: 10, reason: "Joined the cause" },
            { factionId: "WORLD_GOVERNMENT", amount: -6, reason: "Aligned with Revolutionaries" },
          ],
          grantExperience: 15,
        },
      },
      {
        id: "hear_later",
        text: "Listen, but do not commit",
        outcome: {
          text: "They melt into the crowd. The offer remains a rumor in your pocket.",
          offerFactionRecruitment: {
            factionId: "REVOLUTIONARY_ARMY",
            rankId: "rev_sympathizer",
            source: "revolutionary_whisper",
          },
          factionChanges: [{ factionId: "REVOLUTIONARY_ARMY", amount: 2, reason: "Heard the cause" }],
        },
      },
      {
        id: "refuse_rev",
        text: "Walk away",
        outcome: { text: "You leave the alley colder than you found it." },
      },
    ],
  },
  {
    id: "bounty_hunter_guild_pitch",
    title: "Hunter's Notice Board",
    category: "FACTION",
    tier: "EARLY",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png", variant: "parley" },
    description:
      "A scarred clerk stamps licenses for those who hunt names for coin. No navy. No flag. Just contracts.",
    weight: 6,
    conditions: [
      { type: "MEMBERSHIP_STATUS", statuses: ["INDEPENDENT", "FORMER_MEMBER"] },
      { type: "PLAYER_ROLE", roleId: "BOUNTY_HUNTER", negate: true },
    ],
    choices: [
      {
        id: "register",
        text: "Register as Unknown Hunter",
        outcome: {
          text: "Ink dries on a cheap license. You remain a Civilian — but now you are an Unknown Hunter.",
          setRole: {
            roleId: "BOUNTY_HUNTER",
            rankId: "hunter_unknown",
            note: "Registered at hunter board",
          },
          tendencyChanges: {
            bountyCollectionBehavior: 15,
            profitMotive: 8,
            independence: 5,
          },
          grantExperience: 10,
          berriesChange: 50,
        },
      },
      {
        id: "not_now",
        text: "Not today",
        outcome: {
          text: "The board keeps filling with faces. Yours is not among the hunters — yet.",
          offerFactionRecruitment: {
            factionId: "BOUNTY_HUNTER",
            rankId: "hunter_unknown",
            source: "bounty_hunter_guild_pitch",
          },
        },
      },
    ],
  },
  {
    id: "wg_clerk_offer",
    title: "World Government Desk",
    category: "FACTION",
    tier: "MID",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "A polished clerk offers clerical work \"with room to advance.\" Cipher Pol is mentioned only as a rumor for later.",
    weight: 4,
    conditions: [
      { type: "MEMBERSHIP_STATUS", statuses: ["INDEPENDENT", "FORMER_MEMBER"] },
      { type: "PLAYER_AFFILIATION", factionId: "WORLD_GOVERNMENT", negate: true },
      { type: "FACTION_MIN", factionId: "WORLD_GOVERNMENT", value: 5 },
    ],
    choices: [
      {
        id: "accept_clerk",
        text: "Accept as Clerk",
        outcome: {
          text: "A gray badge. Quiet power. You are a World Government Clerk.",
          joinFaction: {
            factionId: "WORLD_GOVERNMENT",
            rankId: "wg_clerk",
            asProspect: true,
            note: "Accepted WG clerk offer",
          },
          factionChanges: [
            { factionId: "WORLD_GOVERNMENT", amount: 8, reason: "Joined WG staff" },
            { factionId: "REVOLUTIONARY_ARMY", amount: -4, reason: "Aligned with WG" },
          ],
          grantExperience: 12,
        },
      },
      {
        id: "decline_wg",
        text: "Decline",
        outcome: {
          text: "The clerk files your refusal without a frown — or a smile.",
          offerFactionRecruitment: {
            factionId: "WORLD_GOVERNMENT",
            rankId: "wg_clerk",
            source: "wg_clerk_offer",
          },
        },
      },
    ],
  },
  {
    id: "island_market_day",
    title: "Market Day",
    category: "SOCIAL",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description: "Stalls overflow with fruit, cloth, and gossip. The island feels alive.",
    weight: 10,
    choices: [
      {
        id: "trade",
        text: "Trade stories for supplies",
        outcome: {
          text: "You spin a tale of distant seas. A merchant tosses you provisions.",
          grantItemIds: ["dried_meat"],
          statChanges: { charisma: 1 },
        },
      },
      {
        id: "browse",
        text: "Browse quietly",
        outcome: { text: "You learn which captains are hiring — and which are hunted." },
      },
    ],
  },
  {
    id: "hidden_cove",
    title: "Hidden Cove",
    category: "EXPLORATION",
    tier: "MID",
    visual: { overlay: "LIGHT", background: "/backgrounds/jungle.png" },
    description: "Through mangroves you find a sheltered cove. Old campfire stones still warm.",
    weight: 9,
    choices: [
      {
        id: "search",
        text: "Search the camp",
        risk: "MODERATE",
        timeCost: "SLOT",
        outcome: {
          text: "You find coins tucked in a hollow log — no weapons, but no traps either.",
          berriesChange: 120,
          grantExperience: 10,
        },
      },
      { id: "rest", text: "Rest here", risk: "LOW", timeCost: "LONG", outcome: { text: "Quiet water. You recover your breath.", hpChange: 15 } },
    ],
  },
  {
    id: "sealed_chest",
    title: "Sealed Chest",
    category: "EXPLORATION",
    tier: "MID",
    visual: { overlay: "SHADOW", background: "/backgrounds/jungle.png" },
    description:
      "A iron-bound chest sits half-buried in sand. No markings — but the lock looks recent, and something shifts inside when the wind changes.",
    weight: 10,
    regions: ["EAST_BLUE", "SOUTH_BLUE"],
    choices: [
      {
        id: "inspect",
        text: "Inspect carefully",
        risk: "LOW",
        timeCost: "SLOT",
        checkStat: "willpower",
        outcome: {
          text: "You study the hinges and hear a faint tick — a needle trap, not a bomb.",
          addInformation: "chest_trap_known",
          grantExperience: 12,
          skillCheck: {
            stat: "willpower",
            difficulty: 6,
            success: {
              text: "You disarm the needle and find a modest stash beneath a false bottom.",
              berriesChange: 180,
              addRunFlags: ["chest_inspected"],
            },
            failure: {
              text: "Your hand slips. A needle pricks your palm before you pull back.",
              hpChange: -6,
            },
          },
        },
      },
      {
        id: "force",
        text: "Force it open",
        risk: "HIGH",
        timeCost: "BRIEF",
        outcome: {
          text: "The lid splinters. Something sharp bites your forearm as coins spill out.",
          hpChange: -12,
          berriesChange: 140,
          addNoise: true,
        },
      },
      {
        id: "pick_lock",
        text: "Pick the lock",
        risk: "MODERATE",
        timeCost: "LONG",
        conditions: [{ type: "STAT_MIN", stat: "speed", value: 6 }],
        outcome: {
          skillCheck: {
            stat: "speed",
            difficulty: 8,
            success: {
              text: "The lock yields with a soft click. Inside: coins and a wrapped parcel.",
              berriesChange: 200,
              grantExperience: 18,
            },
            failure: {
              text: "The pick snaps. The lock jams shut — you'll need another way or walk away.",
              hpChange: -4,
            },
          },
          text: "You work the tumblers by feel.",
        },
      },
      {
        id: "leave",
        text: "Leave it",
        risk: "LOW",
        timeCost: "BRIEF",
        outcome: { text: "Some mysteries aren't worth bleeding for. You move on." },
      },
    ],
  },
  {
    id: "trap_ruins",
    title: "Trapped Ruins",
    category: "EXPLORATION",
    tier: "MID",
    visual: { overlay: "FOG", background: "/backgrounds/jungle.png" },
    description: "Stone steps descend into ruins. Tripwires glint in the dust — someone wanted visitors to choose their pain.",
    weight: 8,
    conditions: [{ type: "CREW_MIN", value: 1 }],
    choices: [
      {
        id: "ren_check",
        text: "Let Ren check the traps",
        risk: "LOW",
        timeCost: "SLOT",
        conditions: [{ type: "CREW_ROLE", role: "NAVIGATOR", minCount: 1 }],
        outcome: {
          text: "Ren maps the wires and marks a safe path. You reach a sealed vault without a scratch.",
          addInformation: "ruins_safe_path",
          grantExperience: 20,
          berriesChange: 160,
        },
      },
      {
        id: "mika_smash",
        text: "Mika smashes through",
        risk: "HIGH",
        timeCost: "BRIEF",
        conditions: [{ type: "CREW_ROLE", role: "FIGHTER", minCount: 1 }, { type: "STAT_MIN", stat: "strength", value: 7, target: "any_crew" }],
        outcome: {
          text: "Mika kicks the stone door off its hinges. Tripwires snap harmlessly behind the dust.",
          hpChange: -4,
          berriesChange: 90,
          addNoise: true,
        },
      },
      {
        id: "careful",
        text: "Proceed carefully alone",
        risk: "MODERATE",
        timeCost: "LONG",
        checkStat: "speed",
        outcome: {
          skillCheck: {
            stat: "speed",
            difficulty: 7,
            success: {
              text: "Slow steps, steady breath. You find a small offering bowl of berries.",
              berriesChange: 110,
              grantExperience: 14,
            },
            failure: {
              text: "A wire catches your ankle. The ceiling drops scrap metal on your shoulders.",
              hpChange: -10,
            },
          },
          text: "You test each stone before putting weight on it.",
        },
      },
      {
        id: "retreat",
        text: "Back away",
        risk: "LOW",
        timeCost: "BRIEF",
        outcome: { text: "The ruins can keep their secrets. For now." },
      },
    ],
  },
  {
    id: "storm_refuge",
    title: "Storm Refuge",
    category: "SEA",
    tier: "EARLY",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png" },
    description: "Lightning splits the sky. A sheltered bay offers refuge — if you can reach it.",
    weight: 8,
    choices: [
      {
        id: "anchor",
        text: "Ride it out",
        outcome: {
          text: "The storm screams all night. By dawn your rigging holds.",
          hpChange: -6,
          statChanges: { willpower: 1 },
        },
      },
      {
        id: "run",
        text: "Run before the wall of water",
        outcome: {
          skillCheck: {
            stat: "speed",
            difficulty: 8,
            success: { text: "You outrun the worst of it." },
            failure: { text: "Waves hammer the hull.", hpChange: -14 },
          },
          text: "You drive through spray and prayer.",
        },
      },
    ],
  },
  // --- Early survival: island day loop, shops, recovery ---
  {
    id: "island_shore_day",
    title: "A Day Ashore",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description:
      "The island offers a full day if you spend it wisely — explore, scavenge, train, or simply recover.",
    weight: 13,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "explore",
        text: "Explore inland",
        timeCost: "LONG",
        risk: "MODERATE",
        flavour: "Risk and reward in the brush.",
        outcome: {
          text: "You push inland.",
          randomTable: [
            {
              weight: 30,
              outcome: { text: "A forgotten stash under loose boards.", berriesChange: 70, grantItemIds: ["travel_rations"] },
            },
            {
              weight: 25,
              outcome: { text: "A quiet spring. You wash and breathe.", hpChange: 18 },
            },
            {
              weight: 20,
              outcome: {
                text: "Locals point you toward a food stall by the docks.",
                discoverShop: "food_stall",
                berriesChange: 20,
              },
            },
            {
              weight: 15,
              outcome: {
                text: "Thorns and a bad step. Nothing fatal.",
                hpChange: -10,
              },
            },
            {
              weight: 10,
              outcome: {
                text: "A clinic sign peeks from a side street.",
                discoverShop: "clinic_shop",
              },
            },
          ],
        },
      },
      {
        id: "search_supplies",
        text: "Search for supplies",
        timeCost: "SLOT",
        flavour: "Food, medicine, or a shop tip.",
        outcome: {
          text: "You comb alleys, crates, and market scraps.",
          randomTable: [
            { weight: 35, outcome: { text: "A rice ball left for the hungry.", grantItemIds: ["rice_ball"] } },
            { weight: 25, outcome: { text: "Dried strips in oilcloth.", grantItemIds: ["dried_meat"] } },
            { weight: 15, outcome: { text: "A clean roll of bandage.", grantItemIds: ["bandage"] } },
            { weight: 15, outcome: { text: "You spot a food stall — noted.", discoverShop: "food_stall" } },
            { weight: 10, outcome: { text: "Empty pockets and sore feet.", berriesChange: 15 } },
          ],
        },
      },
      {
        id: "look_shops",
        text: "Look for shops",
        timeCost: "SLOT",
        flavour: "Ask around for stalls, stores, and clinics.",
        outcome: {
          text: "You ask dockhands and bakers where coin still buys help.",
          randomTable: [
            {
              weight: 40,
              outcome: { text: "A food stall near the pier.", discoverShop: "food_stall" },
            },
            {
              weight: 30,
              outcome: { text: "A general store with dusty shelves.", discoverShop: "general_store" },
            },
            {
              weight: 20,
              outcome: { text: "A small clinic with a bell on the door.", discoverShop: "clinic_shop" },
            },
            {
              weight: 10,
              outcome: { text: "An inn that sells beds and bowls.", discoverShop: "island_inn" },
            },
            {
              weight: 12,
              outcome: { text: "A weapon shop with racks of steel and wood.", discoverShop: "weapon_smith" },
            },
          ],
        },
      },
      {
        id: "train",
        text: "Train",
        timeCost: "BRIEF",
        flavour: "Pick a focus and put the hours in.",
        visual: { variant: "train" },
        outcome: {
          text: "You find open ground, posts, and enough space to hurt yourself usefully.",
          goToEncounter: "island_shore_train",
        },
      },
      {
        id: "rest",
        text: "Rest safely",
        timeCost: "LONG",
        flavour: "No risk. Soft recovery.",
        outcome: {
          text: "Shade, water, and a stretch of quiet. Wounds ease.",
          hpChange: 15,
        },
      },
    ],
  },
  {
    id: "island_shore_train",
    title: "Training Ashore",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png", variant: "train" },
    description: "Strength, speed, or defense — choose what to push before the day slips away.",
    weight: 0,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "train_str",
        text: "Train strength",
        timeCost: "LONG",
        requiresParticipant: true,
        flavour: "Weights, sparring, sweat.",
        visual: { variant: "train", accent: "strength", icon: "gain_strength" },
        outcome: {
          text: "They push until their arms shake.",
          trainStat: "strength",
        },
      },
      {
        id: "train_spd",
        text: "Train speed",
        timeCost: "LONG",
        requiresParticipant: true,
        flavour: "Sprints along the shoreline.",
        visual: { variant: "train", accent: "speed", icon: "gain_speed" },
        outcome: {
          text: "Sand burns underfoot. Their pace sharpens.",
          trainStat: "speed",
        },
      },
      {
        id: "train_def",
        text: "Train defense",
        timeCost: "LONG",
        requiresParticipant: true,
        flavour: "Hold the line against a practice post.",
        visual: { variant: "train", accent: "defense", icon: "gain_defense" },
        outcome: {
          text: "They take hits on purpose until their stance settles.",
          trainStat: "defense",
        },
      },
      {
        id: "train_int",
        text: "Train intelligence",
        timeCost: "LONG",
        requiresParticipant: true,
        flavour: "Charts, puzzles, and careful notes.",
        visual: { variant: "train", accent: "intelligence", icon: "gain_intelligence" },
        outcome: {
          text: "They study until the diagrams stick.",
          trainStat: "intelligence",
        },
      },
      {
        id: "leave",
        text: "Not today",
        timeCost: "BRIEF",
        flavour: "Save the sweat for later.",
        presentation: { primaryLabel: "LEAVE" },
        outcome: {
          text: "You leave the yard alone. Training can wait.",
        },
      },
    ],
  },
  {
    id: "supply_search",
    title: "Scavenger's Round",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/beach.png", variant: "steal" },
    description: "Crates, tide pools, and market refuse — something useful is usually waiting.",
    weight: 10,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "scavenge",
        text: "Scavenge carefully",
        timeCost: "SLOT",
        outcome: {
          text: "You dig through what the island discards.",
          randomTable: [
            { weight: 30, outcome: { text: "Rice ball.", grantItemIds: ["rice_ball"] } },
            { weight: 25, outcome: { text: "Travel rations.", grantItemIds: ["travel_rations"] } },
            { weight: 20, outcome: { text: "Cooked fish wrapped in leaf.", grantItemIds: ["cooked_fish"] } },
            { weight: 15, outcome: { text: "A bandage kit.", grantItemIds: ["bandage"] } },
            { weight: 10, outcome: { text: "Nothing but splinters.", hpChange: -4 } },
          ],
        },
      },
      {
        id: "leave",
        text: "Move on",
        outcome: { text: "You leave the scrap heap to the gulls." },
      },
    ],
  },
  {
    id: "food_stall",
    title: "Food Stall",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description: "Steam, salt, and a chalk board of prices. Stock is limited — buy what you can carry.",
    weight: 9,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "rice",
        text: "Buy rice ball (฿25)",
        conditions: [{ type: "MIN_BERRIES", value: 25 }],
        outcome: {
          text: "Warm rice, wrapped tight. Added to your pack.",
          berriesChange: -25,
          grantItemIds: ["rice_ball"],
        },
      },
      {
        id: "meat",
        text: "Buy dried meat (฿40)",
        conditions: [{ type: "MIN_BERRIES", value: 40 }],
        outcome: {
          text: "Tough strips for the road.",
          berriesChange: -40,
          grantItemIds: ["dried_meat"],
        },
      },
      {
        id: "fish",
        text: "Buy cooked fish (฿55)",
        conditions: [{ type: "MIN_BERRIES", value: 55 }],
        outcome: {
          text: "Still hot. Still yours.",
          berriesChange: -55,
          grantItemIds: ["cooked_fish"],
        },
      },
      {
        id: "rations",
        text: "Buy travel rations (฿50)",
        conditions: [{ type: "MIN_BERRIES", value: 50 }],
        outcome: {
          text: "Hardtack and dried fruit for later.",
          berriesChange: -50,
          grantItemIds: ["travel_rations"],
        },
      },
      { id: "leave", text: "Leave", outcome: { text: "You walk away hungry but solvent." } },
    ],
  },
  {
    id: "general_store",
    title: "General Store",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png" },
    description: "A little of everything: rations, bandages, and rumor.",
    weight: 7,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "rations",
        text: "Buy travel rations (฿50)",
        conditions: [{ type: "MIN_BERRIES", value: 50 }],
        outcome: { text: "Packed for the next stretch.", berriesChange: -50, grantItemIds: ["travel_rations"] },
      },
      {
        id: "bandage",
        text: "Buy bandage (฿70)",
        conditions: [{ type: "MIN_BERRIES", value: 70 }],
        outcome: { text: "Clean cloth for dirty work.", berriesChange: -70, grantItemIds: ["bandage"] },
      },
      {
        id: "meat",
        text: "Buy dried meat (฿40)",
        conditions: [{ type: "MIN_BERRIES", value: 40 }],
        outcome: { text: "Emergency protein.", berriesChange: -40, grantItemIds: ["dried_meat"] },
      },
      {
        id: "water",
        text: "Buy fresh water (฿20)",
        conditions: [{ type: "MIN_BERRIES", value: 20 }],
        outcome: { text: "Clear water for a clearer head.", berriesChange: -20, grantItemIds: ["fresh_water"] },
      },
      {
        id: "grog",
        text: "Buy grog (฿35)",
        conditions: [{ type: "MIN_BERRIES", value: 35 }],
        outcome: { text: "Warmth in a tin cup.", berriesChange: -35, grantItemIds: ["grog"] },
      },
      {
        id: "tonic",
        text: "Buy energy tonic (฿85)",
        conditions: [{ type: "MIN_BERRIES", value: 85 }],
        outcome: { text: "Bitter herbs, sharp focus.", berriesChange: -85, grantItemIds: ["energy_tonic"] },
      },
      { id: "leave", text: "Leave", outcome: { text: "The bell over the door jingles behind you." } },
    ],
  },
  {
    id: "clinic_shop",
    title: "Island Clinic",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description: "Antiseptic and stern advice. Medicine costs, but so does bleeding out.",
    weight: 8,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "bandage",
        text: "Buy bandage (฿70)",
        conditions: [{ type: "MIN_BERRIES", value: 70 }],
        outcome: { text: "Wrapped and ready.", berriesChange: -70, grantItemIds: ["bandage"] },
      },
      {
        id: "basic",
        text: "Buy basic medicine (฿110)",
        conditions: [{ type: "MIN_BERRIES", value: 110 }],
        outcome: { text: "Bitter, effective.", berriesChange: -110, grantItemIds: ["medicine"] },
      },
      {
        id: "kit",
        text: "Buy medical kit (฿180)",
        conditions: [{ type: "MIN_BERRIES", value: 180 }],
        outcome: { text: "A proper kit for serious wounds.", berriesChange: -180, grantItemIds: ["medical_kit"] },
      },
      {
        id: "treat",
        text: "Pay for treatment (฿80)",
        conditions: [{ type: "MIN_BERRIES", value: 80 }],
        flavour: "Stronger heal than resting alone.",
        outcome: {
          text: "The nurse cleans, wraps, and sends you out upright.",
          berriesChange: -80,
          hpChange: 28,
        },
      },
      { id: "leave", text: "Leave", outcome: { text: "You keep your coin and your bruises." } },
    ],
  },
  {
    id: "island_inn",
    title: "Harbor Inn",
    category: "RECOVERY",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png" },
    description: "Beds upstairs, stew downstairs. Coin buys comfort.",
    weight: 7,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "meal",
        text: "Buy a hearty meal (฿90)",
        conditions: [{ type: "MIN_BERRIES", value: 90 }],
        outcome: {
          text: "Stew and bread. You pack the leftovers.",
          berriesChange: -90,
          grantItemIds: ["hearty_meal"],
        },
      },
      {
        id: "room",
        text: "Rent a bed (฿60)",
        timeCost: "LONG",
        conditions: [{ type: "MIN_BERRIES", value: 60 }],
        outcome: {
          text: "A real mattress. You wake less broken.",
          berriesChange: -60,
          hpChange: 22,
        },
      },
      {
        id: "rest_free",
        text: "Doze in the common room",
        timeCost: "LONG",
        outcome: {
          text: "Not private, but better than the deck.",
          hpChange: 12,
        },
      },
      { id: "leave", text: "Leave", outcome: { text: "You step back into the street." } },
    ],
  },
  {
    id: "chase_the_thief",
    title: "Market Chase",
    category: "EXPLORATION",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png", variant: "steal" },
    description:
      "A thief snatches a pouch and bolts through the stalls. Who among the crew can catch them?",
    weight: 0,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "chase",
        text: "Chase the thief",
        timeCost: "SLOT",
        requiresParticipant: true,
        checkStat: "speed",
        flavour: "Speed decides the chase.",
        visual: { variant: "steal", accent: "speed", icon: "gain_speed" },
        outcome: {
          text: "Boots hammer the cobbles.",
          skillCheck: {
            stat: "speed",
            difficulty: 8,
            success: {
              text: "You corner the thief in an alley and recover the pouch.",
              berriesChange: 40,
              grantExperience: 20,
            },
            failure: {
              text: "The thief vanishes into the crowd. Only bruised pride remains.",
              hpChange: -2,
            },
          },
        },
      },
      {
        id: "let_go",
        text: "Let them go",
        timeCost: "BRIEF",
        flavour: "Not every fight is yours.",
        outcome: { text: "The market swallows the thief. The crew moves on." },
      },
    ],
  },
  {
    id: "crew_roadblock",
    title: "Collapsed Road",
    category: "EXPLORATION",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png", variant: "help" },
    description:
      "A fallen wagon and timber block the only road inland. Moving it will take several pairs of hands.",
    weight: 0,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "clear_road",
        text: "Clear the collapsed road",
        timeCost: "LONG",
        requiresParticipant: true,
        minParticipants: 3,
        maxParticipants: 3,
        participantRequirements: [{ type: "MIN_CREW", count: 3 }],
        conditions: [{ type: "CREW_AVAILABLE_MIN", value: 3 }],
        flavour: "Needs three available crew.",
        outcome: {
          text: "Together you heave the wreck aside. The road opens.",
          berriesChange: 25,
          grantExperience: 15,
        },
      },
      {
        id: "force_gate",
        text: "Lift the fallen gate alone",
        timeCost: "SLOT",
        requiresParticipant: true,
        checkStat: "strength",
        participantRequirements: [{ type: "STAT", stat: "strength", minimum: 6 }],
        flavour: "Brute force — if someone is strong enough.",
        outcome: {
          text: "Muscles strain against iron and wood.",
          skillCheck: {
            stat: "strength",
            difficulty: 9,
            success: {
              text: "The gate groans upward. A passage opens.",
              grantExperience: 18,
            },
            failure: {
              text: "It barely budges. Your back complains for hours.",
              hpChange: -4,
            },
          },
        },
      },
      {
        id: "leave_road",
        text: "Find another way",
        timeCost: "SLOT",
        outcome: { text: "You skirt the wreckage through muddy side paths." },
      },
    ],
  },
  {
    id: "dojo_long_training",
    title: "Island Dojo",
    category: "TRAINING",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png", variant: "train" },
    description:
      "A retired swordsman offers intensive instruction — two days of drills, if someone can be spared.",
    weight: 0,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "commit_training",
        text: "Commit to two-day training",
        timeCost: "BRIEF",
        requiresParticipant: true,
        flavour: "They will be unavailable until training ends.",
        outcome: {
          text: "The dojo gates close behind them.",
          startAssignment: {
            type: "WEAPON_TRAINING",
            label: "Sword Dojo Training",
            focus: "SWORD",
            durationSlots: 8,
            berriesCost: 200,
          },
        },
      },
      {
        id: "decline_dojo",
        text: "Decline for now",
        timeCost: "BRIEF",
        outcome: { text: "The swordsman nods. The offer stands while you remain on the island." },
      },
    ],
  },
  {
    id: "ruined_mechanism",
    title: "Sealed Ruin Gate",
    category: "EXPLORATION",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/village.png", variant: "help" },
    description:
      "An old mechanism blocks the entrance to underground ruins. Without diagrams, forcing it looks tempting — and dangerous.",
    weight: 0,
    regions: ["EAST_BLUE"],
    choices: [
      {
        id: "force_gate",
        text: "Force the mechanism (Strength)",
        timeCost: "SLOT",
        requiresParticipant: true,
        checkStat: "strength",
        outcome: {
          text: "Metal screams under pressure.",
          skillCheck: {
            stat: "strength",
            difficulty: 9,
            success: {
              text: "The gate yields — but a hidden needle trap scrapes a forearm.",
              hpChange: -4,
              berriesChange: 20,
            },
            failure: {
              text: "The ring locks harder. A spring-spike jabs out.",
              hpChange: -8,
            },
          },
        },
      },
      {
        id: "examine_gears",
        text: "Examine the gear system",
        timeCost: "SLOT",
        requiresParticipant: true,
        checkStat: "intelligence",
        conditions: [{ type: "RUN_KNOWLEDGE", subjectId: "ancient_gear_system", minStage: "LIMITED" }],
        flavour: "Requires the Ancient Gear Diagram.",
        outcome: {
          text: "The diagram matches the teeth of the outer ring.",
          skillCheck: {
            stat: "intelligence",
            difficulty: 7,
            success: {
              text: "Outer ring first, then the central gear. The trap stays dormant. The ruins open.",
              berriesChange: 35,
              grantExperience: 25,
            },
            failure: {
              text: "You recognize the language of the gears, but mis-order the rings. A warning click — then a shallow cut.",
              hpChange: -3,
            },
          },
        },
      },
      {
        id: "find_diagram",
        text: "Search the rubble for notes",
        timeCost: "LONG",
        outcome: {
          text: "Under a fallen plaque you find a brittle page of gear diagrams.",
          grantKnowledgeCollectable: "ancient_gear_diagram",
        },
      },
      {
        id: "leave_ruin",
        text: "Leave it sealed",
        timeCost: "BRIEF",
        outcome: { text: "The ruins keep their secrets for another day." },
      },
    ],
  },
  {
    id: "milo_memory_reunion",
    title: "Milo Remembers",
    category: "STORY",
    tier: "EARLY",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png", variant: "parley" },
    description:
      "Bounty Hunter Milo leans on the bar. His eyes catch on your face — not the poster, the person.",
    weight: 4,
    narrativeArchetypes: ["bounty_pursuit", "friendship"],
    narrativeThemes: ["bounty_hunter", "dialogue"],
    storyThreadTemplateId: "bounty_hunter_milo",
    bindCharacterId: "npc_milo_hunter",
    dialogueBeats: [
      {
        speakerId: "npc_milo_hunter",
        speakerName: "Milo",
        line: "Last time you pulled me out of a ditch. Don't make me cash that in for a poster.",
        memoryGate: "PLAYER_SAVED_ME",
      },
      {
        speakerId: "npc_milo_hunter",
        speakerName: "Milo",
        line: "Funny. The board pays either way. You choosing the high road today?",
      },
    ],
    conditions: [{ type: "STORY_THREAD", templateId: "bounty_hunter_milo", minStage: 0 }],
    choices: [
      {
        id: "spare_talk",
        text: "Talk it out — hunter to hunter",
        outcome: {
          text: "Milo lowers the warrant. Whatever you are now, he still knows your name.",
          advanceStoryThread: "bounty_hunter_milo",
          addCharacterMemory: { characterId: "npc_milo_hunter", type: "FOUGHT_TOGETHER", importance: 2 },
          tendencyChanges: { compassion: 5, bountyCollectionBehavior: 3 },
        },
      },
      {
        id: "draw_steel",
        text: "Make it a fight",
        outcome: {
          text: "Steel scrapes. Friendship and contracts don't share a table for long.",
          advanceStoryThread: "bounty_hunter_milo",
          addCharacterMemory: { characterId: "npc_milo_hunter", type: "FOUGHT", importance: 2 },
          tendencyChanges: { violenceAgainstPirates: 5, criminality: 4 },
        },
      },
    ],
  },
  {
    id: "marine_partner_assignment",
    title: "Shore Patrol Pairing",
    category: "FACTION",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "A lieutenant slides a thin folder across the desk. \"You're not recruiting. You're being paired.\"",
    weight: 5,
    narrativeArchetypes: ["faction_promotion", "apprenticeship"],
    narrativeThemes: ["marines", "assigned"],
    conditions: [
      { type: "PLAYER_AFFILIATION", factionId: "MARINES" },
    ],
    choices: [
      {
        id: "accept_partner",
        text: "Accept the assigned partner",
        outcome: {
          text: "Seaman Hana salutes stiffly. Official attachment — not a pirate press-gang.",
          setRole: { roleId: "MARINE_OFFICER", note: "Shore patrol pairing" },
          acceptRecruitment: {
            characterId: "npc_marine_hana",
            role: "FIGHTER",
            membership: "ASSIGNED",
          },
          tendencyChanges: { authorityAlignment: 8, obedience: 6, protectionBehavior: 4 },
          grantExperience: 15,
        },
      },
      {
        id: "defer_partner",
        text: "Request a delay",
        outcome: {
          text: "The lieutenant frowns. The folder stays open.",
          tendencyChanges: { independence: 4, obedience: -3 },
        },
      },
    ],
  },
  {
    id: "pirate_free_recruit_contrast",
    title: "Deck Hands Wanted",
    category: "RECRUITMENT",
    tier: "EARLY",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png", variant: "parley" },
    description:
      "A dock tough grins. \"You fly a pirate flag? Then grab whoever's crazy enough. No paperwork.\"",
    weight: 5,
    narrativeArchetypes: ["recruitment"],
    narrativeThemes: ["pirates", "free_recruit"],
    conditions: [{ type: "PLAYER_AFFILIATION", factionId: "PIRATES" }],
    choices: [
      {
        id: "grab_hand",
        text: "Wave them aboard",
        outcome: {
          text: "They hop the rail laughing. Pirate crews grow by hunger and rumor.",
          acceptRecruitment: { characterId: "npc_dock_hand", role: "FIGHTER", membership: "ALLY" },
          tendencyChanges: { criminality: 3, independence: 4 },
        },
      },
      {
        id: "pass_hand",
        text: "Not this one",
        outcome: { text: "They shrug and melt back into the crowd." },
      },
    ],
  },
  {
    id: "hunter_contractor_pitch",
    title: "Contract Partner",
    category: "RECRUITMENT",
    tier: "EARLY",
    visual: { overlay: "TAVERN", background: "/backgrounds/tavern.png", variant: "parley" },
    description:
      "Another hunter slides a split-fee sheet across the table. Partners first. Full crew later.",
    weight: 5,
    narrativeArchetypes: ["recruitment", "bounty_pursuit"],
    narrativeThemes: ["bounty_hunter", "contractor"],
    conditions: [{ type: "PLAYER_ROLE", roleId: "BOUNTY_HUNTER" }],
    choices: [
      {
        id: "sign_contract",
        text: "Sign a contractor split",
        outcome: {
          text: "Ink, percentages, and a temporary partner who still watches the door.",
          acceptRecruitment: {
            characterId: "npc_hunter_kira",
            role: "FIGHTER",
            membership: "CONTRACTOR",
          },
          tendencyChanges: { bountyCollectionBehavior: 6, profitMotive: 5 },
        },
      },
      {
        id: "solo_hunts",
        text: "Hunt alone for now",
        outcome: {
          text: "You keep your share and your solitude.",
          tendencyChanges: { independence: 5 },
        },
      },
    ],
  },
  {
    id: "cipher_pol_partner_briefing",
    title: "Gray Room Briefing",
    category: "FACTION",
    tier: "MID",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "No open recruit. A handler names your partner and burns the paper.",
    weight: 3,
    narrativeArchetypes: ["undercover_mission", "secret_organization"],
    narrativeThemes: ["cipher_pol"],
    storyThreadTemplateId: "cipher_pol_attachment",
    conditions: [
      { type: "PLAYER_AFFILIATION", factionId: "WORLD_GOVERNMENT" },
      { type: "PLAYER_ROLE", roleId: "CIPHER_POL_AGENT" },
    ],
    choices: [
      {
        id: "accept_cp_partner",
        text: "Accept the assignment",
        outcome: {
          text: "Agent Veyl falls into step. Cipher Pol does not ask twice.",
          startStoryThread: "cipher_pol_attachment",
          acceptRecruitment: {
            characterId: "npc_cp_veyl",
            role: "FIGHTER",
            membership: "ASSIGNED",
          },
          setLegalStatus: { statusId: "GOVERNMENT_AGENT", note: "Cipher Pol attachment" },
          tendencyChanges: { worldGovernmentLoyalty: 10, obedience: 8 },
        },
      },
      {
        id: "refuse_cp",
        text: "Request reassignment",
        outcome: {
          text: "The handler's smile does not reach their eyes.",
          tendencyChanges: { rebellion: 6, worldGovernmentLoyalty: -4 },
        },
      },
    ],
  },
  {
    id: "celestial_slave_gaze",
    title: "Eyes Beneath Heaven",
    category: "STORY",
    tier: "MID",
    visual: { overlay: "LIGHT", background: "/backgrounds/city.png", variant: "parley" },
    description:
      "A kneeling attendant looks up. For a heartbeat, the world is not yours by birthright — it is theirs by suffering.",
    weight: 2,
    narrativeArchetypes: ["moral_dilemma", "hidden_lineage"],
    narrativeThemes: ["celestial", "privilege"],
    storyThreadTemplateId: "celestial_privilege_fracture",
    conditions: [
      { type: "PLAYER_ROLE", roleId: "CELESTIAL_DRAGON" },
      { type: "PLAYER_LEGAL_STATUS", statusId: "CELESTIAL_PRIVILEGE" },
    ],
    dialogueBeats: [
      {
        speakerId: "npc_celestial_attendant",
        speakerName: "Attendant",
        line: "World Noble… please. Don't look away.",
      },
    ],
    choices: [
      {
        id: "humane",
        text: "Help them rise",
        outcome: {
          text: "You offer a hand. Somewhere, a protector's patience thins.",
          startStoryThread: "celestial_privilege_fracture",
          tendencyChanges: { compassion: 12, entitlement: -8 },
          grantExperience: 20,
        },
      },
      {
        id: "cruel",
        text: "Remind them of their place",
        outcome: {
          text: "Privilege hardens. The attendant's eyes go empty again.",
          startStoryThread: "celestial_privilege_fracture",
          tendencyChanges: { entitlement: 12, compassion: -10, violenceAgainstCivilians: 6 },
        },
      },
    ],
  },
  {
    id: "celestial_recruit_blocked",
    title: "A Would-Be Crew",
    category: "RECRUITMENT",
    tier: "MID",
    visual: { overlay: "SEA", background: "/backgrounds/sea.png", variant: "parley" },
    description:
      "Common sailors kneel and beg to sail under your protection. Heaven does not keep pirate crews.",
    weight: 2,
    narrativeThemes: ["celestial"],
    conditions: [
      { type: "PLAYER_ROLE", roleId: "CELESTIAL_DRAGON" },
      { type: "PLAYER_LEGAL_STATUS", statusId: "CELESTIAL_PRIVILEGE" },
    ],
    choices: [
      {
        id: "try_recruit",
        text: "Order them onto your ship as crew",
        outcome: {
          text: "Attendants rearrange themselves as staff — never as your crew roster. Privilege forbids it.",
          acceptRecruitment: {
            characterId: "npc_celestial_wannabe",
            role: "FIGHTER",
            membership: "ALLY",
          },
        },
      },
      {
        id: "dismiss_rabble",
        text: "Dismiss them",
        outcome: {
          text: "They scatter. Heaven needs no friends — only distance.",
          tendencyChanges: { entitlement: 4, independence: 3 },
        },
      },
    ],
  },
  {
    id: "dockside_friendly_spar",
    title: "Dockside Challenge",
    category: "SOCIAL",
    tier: "EARLY",
    visual: { overlay: "LIGHT", background: "/backgrounds/port.png", variant: "parley" },
    description:
      "A grinning swordsman from a friendly crew taps the pier with her scabbard. \"No hard feelings — first blood, or first fall. Want to make it interesting?\"",
    weight: 4,
    regions: ["EAST_BLUE", "SOUTH_BLUE", "WEST_BLUE", "NORTH_BLUE"],
    choices: [
      {
        id: "spar_friendly",
        text: "Accept a friendly duel",
        flavour: "Pick someone to step up. Stakes optional.",
        visual: { variant: "fight" },
        outcome: {
          text: "She draws just far enough to show steel. The crowd gives you room.",
          combat: {
            enemyName: "Dockside Sparring Partner",
            enemyStrength: 6,
            combatKind: "SPARRING",
            enemyRole: "NORMAL",
            enemyFamily: "TRAINING",
            compositionTemplateId: "TRAINING_DUMMY",
            isFriendly: true,
            requireSetup: true,
            enemyCount: 1,
            battleFormat: {
              id: "DUEL_1V1",
              minPlayerFighters: 1,
              maxPlayerFighters: 1,
              minEnemies: 1,
              maxEnemies: 1,
              playerChoosesParticipants: true,
              allowCaptainSitOut: true,
              isFriendly: true,
              stakesAllowed: true,
              label: "Friendly Match",
            },
            wager: { type: "NONE", label: "Just training" },
            canEscape: false,
            canSurrender: false,
            win: {
              text: "She laughs, sheathing. \"Good form. Rematch when you've got something new.\"",
            },
            lose: {
              text: "She taps your shoulder with the flat. \"Again sometime — you're almost there.\"",
              hpChange: -2,
            },
          },
        },
      },
      {
        id: "spar_berries",
        text: "Wager 200 Berries on a duel",
        flavour: "Pride with a price.",
        visual: { variant: "fight" },
        outcome: {
          text: "Coin hits the crate between you. She nods.",
          combat: {
            enemyName: "Dockside Sparring Partner",
            enemyStrength: 6,
            combatKind: "SPARRING",
            enemyFamily: "TRAINING",
            isFriendly: true,
            requireSetup: true,
            enemyCount: 1,
            battleFormat: {
              id: "DUEL_1V1",
              minPlayerFighters: 1,
              maxPlayerFighters: 1,
              minEnemies: 1,
              maxEnemies: 1,
              playerChoosesParticipants: true,
              allowCaptainSitOut: true,
              isFriendly: true,
              stakesAllowed: true,
              label: "Friendly Match",
            },
            wager: { type: "BERRIES", berries: 200, label: "฿200" },
            canEscape: false,
            canSurrender: false,
            win: {
              text: "She slides the berries over. \"Earn it fair — you did.\"",
            },
            lose: {
              text: "She pockets the coin with a tip of the hat. \"Drinks on you next time.\"",
              hpChange: -2,
            },
          },
        },
      },
      {
        id: "decline_spar",
        text: "Decline politely",
        outcome: {
          text: "She shrugs. \"Another day, then.\" The pier goes back to work.",
        },
      },
    ],
  },
];
