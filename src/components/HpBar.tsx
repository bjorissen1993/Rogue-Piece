import { ResourceBar } from "./ResourceBar";

type HpBarProps = {
  hp: number;
  maxHp: number;
  flash?: boolean;
  heal?: boolean;
};

export function HpBar({ hp, maxHp, flash = false, heal = false }: HpBarProps) {
  return <ResourceBar current={hp} flash={flash} heal={heal} kind="hp" max={maxHp} />;
}
