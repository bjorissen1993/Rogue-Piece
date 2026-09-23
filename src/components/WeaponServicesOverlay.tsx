import { useMemo, useState } from "react";
import { SEASTONE_OPTIONS } from "../data/weaponServices";
import { WEAPON_SERVICE_GATES, namingPoolCategoryFor } from "../data/weaponProgression";
import type { RunState, SeastoneMod, WeaponNamingPath } from "../models/types";
import { createRng } from "../services/RandomService";
import { WeaponProgressionService } from "../services/WeaponProgressionService";
import { WeaponService } from "../services/WeaponService";
import { WeaponServicesService } from "../services/WeaponServicesService";
import { weaponRarityClass } from "../utils/weaponRarity";
import { WeaponIdentityBlock } from "./WeaponIdentityBlock";
import { WeaponStatsBlock } from "./WeaponStatsBlock";

type WeaponServicesOverlayProps = {
  run: RunState;
  onClose: () => void;
  onUpgrade: (instanceId: string, advanced?: boolean) => string;
  onSeastone: (instanceId: string, mod: SeastoneMod) => string;
  onBindFruit: (instanceId: string, fruitId: string) => string;
  onRename: (instanceId: string, name: string) => string;
  onNameStage: (instanceId: string, path: WeaponNamingPath, adjective: string) => string;
  onDestroy: (instanceId: string, confirmPhrase: string) => string;
};

export function WeaponServicesOverlay({
  run,
  onClose,
  onUpgrade,
  onSeastone,
  onBindFruit,
  onRename,
  onNameStage,
  onDestroy,
}: WeaponServicesOverlayProps) {
  const owned = useMemo(() => WeaponService.listCrewWeapons(run), [run]);
  const [selectedId, setSelectedId] = useState<string | null>(owned[0]?.instance.id ?? null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [destroyText, setDestroyText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const selected = owned.find((entry) => entry.instance.id === selectedId)?.instance ?? null;
  const view = selected ? WeaponService.resolveWeaponView(selected) : undefined;
  const inspect = selected ? WeaponServicesService.inspect(run, selected.id) : null;
  const compat = selected ? WeaponServicesService.compatibility(run, selected.id) : null;
  const fruits = WeaponServicesService.ownedFruits(run);
  const wielderId = selected ? (selected.ownerCharacterId ?? run.player.id) : run.player.id;
  const choices = useMemo(() => {
    if (!selected) {
      return [];
    }
    return WeaponProgressionService.generateNamingChoices(
      selected,
      createRng(`${run.seed}:name:${selected.id}:${WeaponProgressionService.namingStage(selected)}`),
    );
  }, [run.seed, selected]);

  const report = (line: string) => {
    setFeedback(line);
    setConfirmDestroy(false);
    setDestroyText("");
  };

  return (
    <div className="overlay-scrim weapon-shop-scrim">
      <section className="weapon-shop-shell panel weapon-services-shell">
        <div className="weapon-shop-body">
          <header className="weapon-shop-head">
            <div>
              <p className="hud-kicker">Weapon Shop</p>
              <h2 className="font-display text-3xl text-gold">Weapon Services</h2>
              <p className="weapon-shop-proprietor">
                One bench. Upgrade, seastone, fruit, and naming — pick a weapon you own.
              </p>
            </div>
            <div className="weapon-shop-purse">
              <span>Your berries</span>
              <strong>฿{run.player.berries}</strong>
            </div>
          </header>

          <div className="weapon-shop-layout is-trade weapon-services-layout">
            <div className="weapon-shop-column">
              <p className="detail-label">Owned weapons</p>
              <ul className="weapon-shop-list">
                {owned.length === 0 ? (
                  <li className="weapon-shop-empty">No weapons in your pack.</li>
                ) : (
                  owned.map(({ instance, ownerLabel }) => {
                    const rowView = WeaponService.resolveWeaponView(instance);
                    if (!rowView) {
                      return null;
                    }
                    return (
                      <li key={instance.id}>
                        <button
                          className={`weapon-shop-row ${selectedId === instance.id ? "is-selected" : ""}`}
                          onClick={() => {
                            setSelectedId(instance.id);
                            setRenameValue("");
                            setConfirmDestroy(false);
                            setFeedback(null);
                          }}
                          type="button"
                        >
                          <span className={`weapon-shop-row-name ${weaponRarityClass(rowView.rarity, rowView.material)}`}>
                            {rowView.name}
                          </span>
                          <span className="weapon-shop-row-type">{ownerLabel}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <aside className="weapon-shop-aside weapon-services-aside">
              {selected && view && inspect ? (
                <>
                  <WeaponStatsBlock weapon={view} />
                  <WeaponIdentityBlock item={selected} run={run} wielderId={wielderId} />

                  <section className="weapon-service-block">
                    <p className="detail-label">Upgrades</p>
                    <p className="weapon-shop-hint">
                      Gated by mastery with this weapon ({inspect.identity.wielderMastery}).
                    </p>
                    <div className="weapon-service-actions">
                      <button
                        className="gold-btn"
                        onClick={() => report(onUpgrade(selected.id, false))}
                        type="button"
                      >
                        Upgrade ({WEAPON_SERVICE_GATES.UPGRADE.toLowerCase()})
                      </button>
                      <button
                        className="choice-btn"
                        onClick={() => report(onUpgrade(selected.id, true))}
                        type="button"
                      >
                        Advanced ({WEAPON_SERVICE_GATES.ADVANCED_UPGRADE.toLowerCase()})
                      </button>
                    </div>
                  </section>

                  <section className="weapon-service-block">
                    <p className="detail-label">Seastone</p>
                    {compat?.seastoneLocked ? (
                      <p className="weapon-service-locked">LOCKED: {compat.seastoneReason}</p>
                    ) : (
                      <ul className="weapon-service-options">
                        {SEASTONE_OPTIONS.map((option) => (
                          <li key={option.id}>
                            <button
                              className="choice-btn"
                              onClick={() => report(onSeastone(selected.id, option.id))}
                              type="button"
                            >
                              {option.label}
                            </button>
                            <span>{option.description}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="weapon-service-block">
                    <p className="detail-label">Devil Fruit binding</p>
                    {compat?.fruitLocked ? (
                      <p className="weapon-service-locked">LOCKED: {compat.fruitReason}</p>
                    ) : fruits.length === 0 ? (
                      <p className="weapon-shop-hint">No unbound fruit in your pack.</p>
                    ) : (
                      fruits.map((fruit) => (
                        <button
                          className="gold-btn"
                          key={fruit.fruitId}
                          onClick={() => report(onBindFruit(selected.id, fruit.fruitId))}
                          type="button"
                        >
                          Bind {fruit.name}
                        </button>
                      ))
                    )}
                    <p className="weapon-shop-hint">Requires {WEAPON_SERVICE_GATES.DEVIL_FRUIT_BIND.toLowerCase()} mastery with this weapon.</p>
                  </section>

                  <section className="weapon-service-block">
                    <p className="detail-label">Naming</p>
                    <p className="weapon-shop-hint">
                      {namingPoolCategoryFor({
                        category: selected.generatedWeapon?.category,
                        weaponType: view.weaponType,
                        archetypeId: selected.generatedWeapon?.archetypeId ?? selected.weaponDefinitionId,
                      })}{" "}
                      pool · stage {inspect.identity.namingStage}
                    </p>
                    {WeaponProgressionService.canSetBaseName(selected).ok ? (
                      <div className="weapon-service-rename">
                        <input
                          aria-label="Custom weapon name"
                          maxLength={28}
                          onChange={(event) => setRenameValue(event.target.value)}
                          placeholder="Custom base name"
                          value={renameValue}
                        />
                        <button className="choice-btn" onClick={() => report(onRename(selected.id, renameValue))} type="button">
                          Seal name
                        </button>
                      </div>
                    ) : (
                      <p className="weapon-shop-hint">{WeaponProgressionService.canSetBaseName(selected).reason}</p>
                    )}
                    {choices.length === 3 ? (
                      <div className="weapon-service-actions">
                        {choices.map((choice) => (
                          <button
                            className="choice-btn"
                            key={choice.path}
                            onClick={() => report(onNameStage(selected.id, choice.path, choice.adjective))}
                            type="button"
                          >
                            {choice.label}: {choice.adjective}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="weapon-shop-hint">Naming Evolution is complete.</p>
                    )}
                  </section>

                  <section className="weapon-service-block">
                    <p className="detail-label">Destroy host</p>
                    <p className="weapon-shop-hint">
                      Permanent. Frees a bound fruit into the world — it does not drop into your pack.
                    </p>
                    {confirmDestroy ? (
                      <div className="weapon-service-rename">
                        <input
                          aria-label="Type destroy to confirm"
                          onChange={(event) => setDestroyText(event.target.value)}
                          placeholder="Type DESTROY"
                          value={destroyText}
                        />
                        <button className="ghost-btn" onClick={() => report(onDestroy(selected.id, destroyText))} type="button">
                          Confirm destroy
                        </button>
                      </div>
                    ) : (
                      <button className="ghost-btn" onClick={() => setConfirmDestroy(true)} type="button">
                        Unmake this weapon
                      </button>
                    )}
                  </section>

                  {feedback ? <p className="weapon-shop-compare">{feedback}</p> : null}
                </>
              ) : (
                <p className="weapon-shop-empty">Select a weapon you own.</p>
              )}
            </aside>
          </div>
        </div>
        <div className="weapon-shop-actions weapon-shop-actions-sticky">
          <button className="choice-btn" onClick={onClose} type="button">
            Leave bench
          </button>
        </div>
      </section>
    </div>
  );
}
