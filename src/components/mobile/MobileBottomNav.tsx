import type { HudIconName } from "../HudIcons";
import { HudIcon } from "../HudIcons";

export type MobileNavId = "game" | "crew" | "bag" | "factions" | "more";

type NavItem = {
  id: MobileNavId;
  label: string;
  icon: HudIconName;
};

const ITEMS: NavItem[] = [
  { id: "game", label: "Game", icon: "map" },
  { id: "crew", label: "Crew", icon: "anchor" },
  { id: "bag", label: "Bag", icon: "pouch" },
  { id: "factions", label: "Factions", icon: "skull" },
  { id: "more", label: "More", icon: "menu" },
];

type MobileBottomNavProps = {
  active: MobileNavId;
  onSelect: (id: MobileNavId) => void;
  /** Hide during combat fullscreen focus if desired. */
  hidden?: boolean;
};

export function MobileBottomNav({ active, onSelect, hidden }: MobileBottomNavProps) {
  if (hidden) {
    return null;
  }

  return (
    <nav aria-label="Main" className="mobile-bottom-nav">
      {ITEMS.map((item) => (
        <button
          aria-current={active === item.id ? "page" : undefined}
          className={`mobile-nav-btn ${active === item.id ? "is-active" : ""}`}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <HudIcon name={item.icon} size={22} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
