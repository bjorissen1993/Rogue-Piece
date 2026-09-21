import type { CSSProperties, ReactNode } from "react";
import type { StatName } from "../models/types";
import { STAT_LABELS } from "../utils/text";
import { statHint } from "../utils/presentation";
import { HudArt } from "./HudIcons";

type StatIconProps = {
  stat: StatName;
  size?: number;
  showTooltip?: boolean;
  className?: string;
};

export type CombatActionName =
  | "attack"
  | "technique"
  | "defend"
  | "observe"
  | "item"
  | "escape"
  | "surrender";

export type EncounterActionName =
  | "fight"
  | "parley"
  | "escape"
  | "help"
  | "steal"
  | "train"
  | "cutRope"
  | "keepDistance"
  | "search"
  | "stealth"
  | "track"
  | "treasure"
  | "explore"
  | "rest"
  | "join"
  | "joinTemporarily"
  | "default";

const STAT_ART: Record<StatName, string> = {
  strength: "/icons/Stats/strength.png",
  defense: "/icons/Stats/defense.png",
  speed: "/icons/Stats/speed.png",
  willpower: "/icons/Stats/willpower.png",
  charisma: "/icons/Stats/charisma.png",
  intelligence: "/icons/Stats/Intelligence.png",
};

const ACTION_ART: Partial<Record<ActionIconName, string>> = {
  attack: "/icons/BattleUI/attack.png",
  technique: "/icons/BattleUI/technique.png",
  defend: "/icons/BattleUI/defend.png",
  observe: "/icons/BattleUI/observe.png",
  item: "/icons/UI/item.png",
  escape: "/icons/BattleUI/escape.png",
  fight: "/icons/Events/fight.png",
  parley: "/icons/Events/talk.png",
  cutRope: "/icons/Events/cut-rope.png",
  help: "/icons/Events/help.png",
  keepDistance: "/icons/Events/keep-distance.png",
  search: "/icons/Events/search.png",
  stealth: "/icons/Events/stealth.png",
  track: "/icons/Events/track.png",
  treasure: "/icons/Events/treasure.png",
  steal: "/icons/Events/treasure.png",
  explore: "/icons/Events/explore.png",
  rest: "/icons/Events/rest.png",
  join: "/icons/Events/join.png",
  joinTemporarily: "/icons/Events/join-temporarily.png",
};

export type ActionIconName = CombatActionName | EncounterActionName;

const STAT_MARKS: Record<StatName, ReactNode> = {
  strength: (
    <>
      <path d="M5 20.6c.3-4.6 2.1-7.6 5.6-9.2" />
      <path d="M9.8 12c.3-3.4 2.2-5.8 5.2-5.9 1.9 0 2.8 1.5 2.5 3.1-.3 1.4-1.5 2.2-3.1 2.5" />
      <path d="M14.4 11.8c3.3.7 6 2.6 7 5.6.3 1-.4 2.1-1.6 2.1H10" />
      <path d="M19.8 15.6c.7.4 1 1.2.6 2" />
    </>
  ),
  defense: <path d="M12 3 5 6v6c0 5 3.5 8.5 7 9.5 3.5-1 7-4.5 7-9.5V6l-7-3Z" />,
  speed: (
    <>
      <circle cx="15.4" cy="5.3" r="2" />
      <path d="M14 7.5 10.6 13.4" />
      <path d="M13.4 8.8 18.1 7" />
      <path d="M13 9.4 8.8 11.8" />
      <path d="M10.6 13.4 14.6 16.4 13.3 20.5" />
      <path d="M10.6 13.4 6.2 15.3 7.8 19.6" />
    </>
  ),
  willpower: (
    <>
      <path d="M12 4.4c-2.1 0-3.7 1.2-4.4 2.9-1.4.2-2.6 1.5-2.6 3.1 0 1.1.6 2.1 1.6 2.6-.2.5-.3 1-.3 1.6 0 2.4 2.1 4.2 5.7 4.2s5.7-1.8 5.7-4.2c0-.6-.1-1.1-.3-1.6 1-.5 1.6-1.5 1.6-2.6 0-1.6-1.2-2.9-2.6-3.1-.7-1.7-2.3-2.9-4.4-2.9Z" />
      <path d="M12 5.2v12.6" />
      <path d="M8.1 9.1c1.1-.8 2.3-1 3.4-.3" />
      <path d="M15.9 9.1c-1.1-.8-2.3-1-3.4-.3" />
      <path d="M8 12.6c1.3.8 2.8.9 4 .1" />
      <path d="M16 12.6c-1.3.8-2.8.9-4 .1" />
    </>
  ),
  charisma: (
    <>
      <circle cx="8.2" cy="9.6" r="3.7" />
      <path d="M5.5 13c.5 2.3 2 3.8 4.2 4.2" />
      <path d="M7 10.6c.6.5 1.5.5 2.1 0" />
      <path d="M13.6 5.6h7.4v5.4h-2.7l-2.3 2.5v-2.5H13.6Z" />
    </>
  ),
  intelligence: (
    <>
      <circle cx="12" cy="10" r="5.2" />
      <path d="M9.2 18.2h5.6" />
      <path d="M10 20h4" />
      <path d="M12 5.2V3.6" />
      <path d="M8.1 6.4 6.8 5.2" />
      <path d="M15.9 6.4 17.2 5.2" />
    </>
  ),
};

const ACTION_MARKS: Record<ActionIconName, ReactNode> = {
  attack: <path d="M5 19 19 5M14 5h5v5M9 12l3 3-6 6H3v-3l6-6Z" />,
  technique: <path d="M12 3v4M12 17v4M4.9 7.5l3.5 2M15.6 14.5l3.5 2M4.9 16.5l3.5-2M15.6 9.5l3.5-2M12 12l-2 5 6-5-6-5 2 5Z" />,
  defend: <path d="M12 3 5 6v6c0 5 3.5 8.5 7 9.5 3.5-1 7-4.5 7-9.5V6l-7-3Z" />,
  observe: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  item: <path d="M4 8h16l-1.2 11.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8L4 8Zm4-3h8l1 3H7l1-3Z" />,
  surrender: <path d="M5 21V4m0 0h9l-1.5 3L14 10H5" />,
  fight: (
    <>
      <path d="M6.2 18.6 16.4 6.2" />
      <path d="M13.8 5.6h4.4v4.4" />
      <path d="M17.8 18.6 7.6 6.2" />
      <path d="M5.8 5.6h4.4v4.4" />
    </>
  ),
  parley: (
    <>
      <path d="M4.6 13.4c1.8-2.4 4.6-2.6 7.4 0 2.8-2.6 5.6-2.4 7.4 0" />
      <path d="M12 13.4v5.2" />
      <path d="M8.2 14.2 6.4 17.6" />
      <path d="M15.8 14.2 17.6 17.6" />
      <path d="M9 8.2h5.6v3.4h-2l-1.6 1.8V11.6H9Z" />
    </>
  ),
  escape: (
    <>
      <circle cx="14.6" cy="5.6" r="1.9" />
      <path d="M13.6 7.6 11.4 13.4" />
      <path d="M12.8 8.8 16.8 7.4" />
      <path d="M11.4 13.4 14.8 16.2 13.8 20.2" />
      <path d="M11.4 13.4 7.4 15.2 8.8 19.2" />
      <path d="M3.2 8.6h4.2M3.2 12h3.6M3.4 15.4h3.8" />
    </>
  ),
  help: (
    <>
      <path d="M8.2 12.2v4.6c0 2.2 1.7 3.8 4 3.8s4-1.6 4-3.8V11" />
      <path d="M8.2 13.6c-1.8-.6-2.8-2-2.2-3.4.6-1.2 2.2-.8 2.8.6" />
      <path d="M10.2 11.4V6.6c0-.8.8-1.2 1.3-.7.4.4.5 1.1.5 1.9v3.6" />
      <path d="M12.6 11V5.6c0-.8.8-1.1 1.3-.6.4.4.5 1.2.5 2.1V11" />
      <path d="M15 11.2V7.2c0-.8.7-1.1 1.2-.5.4.5.5 1.2.5 2.2v2.3" />
    </>
  ),
  steal: (
    <>
      <path d="M4.4 18.2c.8-4.4 3.4-7 7.4-6.2 1.2 2.8.4 6.4-2.2 7.8-2.2 1.2-4.6 1-5.2-1.6Z" />
      <path d="M11.6 12.4 16.4 8.2" />
      <path d="M12.4 13.8 18 11.2" />
      <path d="M12.2 15.4 17.4 16" />
    </>
  ),
  train: (
    <>
      <path d="M6 12h12" />
      <path d="M5 8.2v7.6M7.4 9.4v5.2" />
      <path d="M19 8.2v7.6M16.6 9.4v5.2" />
    </>
  ),
  cutRope: (
    <>
      <path d="M6.2 17.8 16.8 6.4" />
      <path d="M14.6 5.8h3.8v3.8" />
      <path d="M5.6 8.4c1.8 1.6 3.6 1.6 5.4 0" />
      <path d="M13 15.6c1.8 1.6 3.6 1.6 5.4 0" />
    </>
  ),
  keepDistance: (
    <>
      <path d="M4.6 12h5.2M14.2 12h5.2" />
      <path d="M8.4 9.4 5.8 12l2.6 2.6" />
      <path d="M15.6 9.4 18.2 12l-2.6 2.6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.4" cy="10.4" r="5.2" />
      <path d="M14.4 14.4 19.2 19.2" />
    </>
  ),
  stealth: (
    <>
      <path d="M5 19c1.4-3.6 3.8-6.4 7-6.4s5.6 2.8 7 6.4" />
      <circle cx="12" cy="8.4" r="2.4" />
      <path d="M4.2 8.6h3.4M16.4 8.6h3.4" />
    </>
  ),
  track: (
    <>
      <path d="M6.2 17.4c1.2-1.8 2-3.2 2-4.4 0-1.2-.8-1.8-1.6-1.8S5 11.8 5 13c0 1 .6 2.2 1.2 4.4Z" />
      <path d="M11.2 14.2c1-1.6 1.7-2.8 1.7-3.8 0-1-.7-1.5-1.4-1.5s-1.4.6-1.4 1.6c0 .9.5 2 1.1 3.7Z" />
      <path d="M16.4 10.4c.9-1.4 1.5-2.5 1.5-3.4 0-.9-.6-1.3-1.2-1.3s-1.2.5-1.2 1.4c0 .8.4 1.8 1 3.3Z" />
    </>
  ),
  treasure: (
    <>
      <path d="M5.2 10.2h13.6l-1 8.4H6.2Z" />
      <path d="M8 10.2 9.2 6.6h5.6L16 10.2" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="7.2" />
      <path d="M12 6.2 13.8 12 12 17.8 10.2 12Z" />
      <circle cx="12" cy="12" r="1.1" />
    </>
  ),
  rest: (
    <>
      <path d="M5.2 16.6h13.6" />
      <path d="M7.2 16.6v-4.2c1.4-1.6 3.2-2.4 4.8-2.4s3.4.8 4.8 2.4v4.2" />
      <path d="M9.4 8.2c.8-1.4 2-2.2 3.4-2.2" />
    </>
  ),
  join: (
    <>
      <path d="M7.2 12.2h3.6M13.2 12.2h3.6" />
      <path d="M9.6 9.8 7.2 12.2l2.4 2.4" />
      <path d="M14.4 9.8 16.8 12.2l-2.4 2.4" />
    </>
  ),
  joinTemporarily: (
    <>
      <path d="M8.2 13.6c1.6-1.8 3.2-1.8 4.8 0 1.6-1.8 3.2-1.8 4.8 0" />
      <path d="M8.6 7.2h2.8v6.2H8.6Z" />
      <path d="M8.6 7.2 7.4 5.6h5.2L11.4 7.2" />
    </>
  ),
  default: <path d="M12 3.4 13.6 10.4 21 12 13.6 13.6 12 20.6 10.4 13.6 3 12 10.4 10.4Z" />,
};

function SvgMark({
  size,
  className,
  children,
}: {
  size: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

export function StatIcon({ stat, size = 18, showTooltip = true, className = "" }: StatIconProps) {
  const label = STAT_LABELS[stat];
  const title = `${label} — ${statHint(stat)}`;
  const art = STAT_ART[stat];
  const icon = art ? (
    <HudArt className={`stat-icon ${className}`.trim()} size={size} src={art} />
  ) : (
    <SvgMark className={`stat-icon ${className}`.trim()} size={size}>
      {STAT_MARKS[stat]}
    </SvgMark>
  );

  if (!showTooltip) {
    return icon;
  }

  return (
    <span className="icon-tip" style={{ "--tip": `"${title}"` } as CSSProperties} title={title}>
      {icon}
      <span className="sr-only">{title}</span>
    </span>
  );
}

export function ActionIcon({
  name,
  size = 22,
  className = "",
}: {
  name: ActionIconName;
  size?: number;
  className?: string;
}) {
  const art = ACTION_ART[name];
  if (art) {
    return <HudArt className={className} size={size} src={art} />;
  }
  return (
    <SvgMark className={["hud-icon", className].filter(Boolean).join(" ") || undefined} size={size}>
      {ACTION_MARKS[name]}
    </SvgMark>
  );
}
