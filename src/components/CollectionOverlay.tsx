import { useMemo, useState } from "react";
import { DEVIL_FRUITS } from "../data/devilFruits";
import { ITEMS } from "../data/items";
import { RACES } from "../data/races";
import { techniquesForFruit } from "../data/collectionLore";
import type { ProfileSave } from "../models/types";
import { CollectionService } from "../services/CollectionService";
import { RaceService } from "../services/RaceService";
import { OverlayFrame } from "./OverlayFrame";

type CollectionOverlayProps = {
  profile: ProfileSave;
  onClose: () => void;
};

type Tab = "fruits" | "items" | "races";

function fruitTypeLabel(type: string): string {
  if (type === "PARAMECIA") return "Paramecia";
  if (type === "ZOAN") return "Zoan";
  return "Logia";
}

export function CollectionOverlay({ profile, onClose }: CollectionOverlayProps) {
  const [tab, setTab] = useState<Tab>("fruits");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fruit = DEVIL_FRUITS.find((item) => item.id === selectedId);
  const item = ITEMS.find((entry) => entry.id === selectedId);
  const race = RACES.find((entry) => entry.id === selectedId);

  const fruitKnowledge = fruit ? CollectionService.fruitKnowledge(profile, fruit.id) : undefined;
  const itemKnowledge = item ? CollectionService.itemKnowledge(profile, item.id) : undefined;
  const raceRow = race ? RaceService.getProgress(profile, race.id) : undefined;

  const fruitLore = fruit ? CollectionService.visibleFruitLore(profile, fruit.id) : [];
  const raceLore = race ? RaceService.visibleLore(profile, race.id) : [];
  const techniques = fruit ? techniquesForFruit(fruit.id) : [];

  const heading = useMemo(() => {
    if (tab === "fruits") return "Devil Fruits";
    if (tab === "items") return "Items";
    return "Races";
  }, [tab]);

  const selectEntry = (id: string, el: HTMLElement) => {
    setSelectedId(id);
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <OverlayFrame eyebrow="LEDGER" title="Collection" onClose={onClose}>
      <div className="mb-4 flex shrink-0 flex-wrap gap-2">
        {(
          [
            ["fruits", "Devil Fruits"],
            ["items", "Items"],
            ["races", "Races"],
          ] as const
        ).map(([id, label]) => (
          <button
            className={`tab-btn ${tab === id ? "is-selected" : ""}`}
            key={id}
            onClick={() => {
              setTab(id);
              setSelectedId(null);
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="split-overlay">
        <div className="split-pane">
          <h3 className="collection-heading">{heading}</h3>
          <div className="split-grid ledger-grid">
            {tab === "fruits"
              ? DEVIL_FRUITS.map((entry) => {
                  const found = CollectionService.fruitKnowledge(profile, entry.id);
                  const discovered = Boolean(found?.discovered);
                  return (
                    <button
                      className={`select-card collection-card ${selectedId === entry.id ? "is-selected" : ""} ${discovered ? "" : "is-locked"}`}
                      disabled={!discovered}
                      key={entry.id}
                      onClick={(event) => discovered && selectEntry(entry.id, event.currentTarget)}
                      type="button"
                    >
                      <p className="collection-card-title font-display text-xl">{discovered ? entry.name : "???"}</p>
                      <p className="collection-card-subtitle text-sm text-parchment-dim">{discovered ? fruitTypeLabel(entry.type) : "Undiscovered"}</p>
                    </button>
                  );
                })
              : null}
            {tab === "items"
              ? ITEMS.map((entry) => {
                  const found = CollectionService.itemKnowledge(profile, entry.id);
                  const discovered = Boolean(found?.discovered);
                  return (
                    <button
                      className={`select-card collection-card ${selectedId === entry.id ? "is-selected" : ""} ${discovered ? "" : "is-locked"}`}
                      disabled={!discovered}
                      key={entry.id}
                      onClick={(event) => discovered && selectEntry(entry.id, event.currentTarget)}
                      type="button"
                    >
                      <p className="collection-card-title font-display text-xl">{discovered ? entry.name : "???"}</p>
                      <p className="collection-card-subtitle text-sm text-parchment-dim">{discovered ? "Discovered" : "Undiscovered"}</p>
                    </button>
                  );
                })
              : null}
            {tab === "races"
              ? RACES.map((entry) => {
                  const row = RaceService.getProgress(profile, entry.id);
                  const known = Boolean(row?.known);
                  return (
                    <button
                      className={`select-card collection-card ${selectedId === entry.id ? "is-selected" : ""} ${known ? "" : "is-locked"}`}
                      disabled={!known}
                      key={entry.id}
                      onClick={(event) => known && selectEntry(entry.id, event.currentTarget)}
                      type="button"
                    >
                      <p className="collection-card-title font-display text-xl">{known ? entry.name : "???"}</p>
                      <p className="collection-card-subtitle text-sm text-parchment-dim">
                        {known ? (row?.playable ? "Playable" : "Discovered") : "Undiscovered"}
                      </p>
                    </button>
                  );
                })
              : null}
          </div>
        </div>
        <aside className="detail-panel panel">
          {!selectedId ? (
            <p className="text-parchment-dim">Select a discovered entry. The rest of the sea stays blank on purpose.</p>
          ) : null}
          {fruit && fruitKnowledge?.discovered ? (
            <div className="space-y-3">
              <p className="hud-kicker">Devil Fruit</p>
              <h3 className="font-display text-3xl">{fruit.name}</h3>
              <p className="text-gold">{fruitTypeLabel(fruit.type)}</p>
              {fruitLore.map((entry) => (
                <div key={entry.id}>
                  <p className="text-sm text-gold">{entry.title}</p>
                  <p className="text-parchment-dim">{entry.body}</p>
                </div>
              ))}
              {fruitLore.length <= 1 ? (
                <p className="text-sm text-parchment-dim">More information unknown.</p>
              ) : null}
              <div className="mt-4">
                <p className="collection-heading">Techniques</p>
                {techniques.length === 0 ? (
                  <p className="text-sm text-parchment-dim">No recorded techniques yet.</p>
                ) : (
                  techniques.map((tech) => {
                    const known = fruitKnowledge.discoveredTechniques.includes(tech.id);
                    return (
                      <p className="mt-2" key={tech.id}>
                        {known ? (
                          <>
                            <span className="text-gold">{tech.name}</span>
                            <span className="text-parchment-dim"> — {tech.description}</span>
                          </>
                        ) : (
                          <span className="text-parchment-dim">??? Undiscovered technique...</span>
                        )}
                      </p>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
          {item && itemKnowledge?.discovered ? (
            <div className="space-y-3">
              <p className="hud-kicker">Item</p>
              <h3 className="font-display text-3xl">{item.name}</h3>
              <p className="text-gold">{item.type}</p>
              <p className="text-parchment-dim">{item.description}</p>
            </div>
          ) : null}
          {race && raceRow?.known ? (
            <div className="space-y-3">
              <p className="hud-kicker">Race</p>
              <h3 className="font-display text-3xl">{race.name}</h3>
              <p className="text-gold">{raceRow.playable ? "Playable" : "Known, not yet playable"}</p>
              {raceLore.map((entry) => (
                <div key={entry.id}>
                  <p className="text-sm text-gold">{entry.title}</p>
                  <p className="text-parchment-dim">{entry.body}</p>
                </div>
              ))}
              {raceLore.length <= 1 ? (
                <p className="text-sm text-parchment-dim">More information unknown.</p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </OverlayFrame>
  );
}
