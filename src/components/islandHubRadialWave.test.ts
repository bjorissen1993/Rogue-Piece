import { describe, expect, it } from "vitest";
import {
  nearestRadialChildLabel,
  radialOrbitAuraRadius,
  radialOrbitWaveScale,
  RADIAL_ORBIT_LABEL_AURA,
  RADIAL_ORBIT_WAVE_PEAK,
} from "./islandHubRadialWave";

const kids = [
  { id: "buy", label: "Buy Ship", dist: 40 },
  { id: "fit", label: "Customize", dist: 70 },
  { id: "sail", label: "Depart", dist: 95 },
];

describe("radialOrbitWaveScale", () => {
  it("peaks at the cursor and eases to 1 outside range", () => {
    expect(RADIAL_ORBIT_WAVE_PEAK).toBeGreaterThanOrEqual(1.28);
    expect(radialOrbitWaveScale(0)).toBeCloseTo(RADIAL_ORBIT_WAVE_PEAK);
    expect(radialOrbitWaveScale(150)).toBe(1);
    expect(radialOrbitWaveScale(200)).toBe(1);
    expect(radialOrbitWaveScale(55)).toBeGreaterThan(1);
    expect(radialOrbitWaveScale(55)).toBeLessThan(RADIAL_ORBIT_WAVE_PEAK);
  });
});

describe("nearestRadialChildLabel", () => {
  const orbit = 60;
  const aura = radialOrbitAuraRadius(orbit);

  it("uses 1.85× orbit as the hide distance", () => {
    expect(aura).toBeCloseTo(orbit * RADIAL_ORBIT_LABEL_AURA);
  });

  it("returns the nearest child while inside the aura", () => {
    expect(nearestRadialChildLabel(orbit, aura, kids)?.id).toBe("buy");
    expect(nearestRadialChildLabel(orbit, aura, kids)?.label).toBe("Buy Ship");
  });

  it("hides the label when the pointer is far outside the circle", () => {
    expect(nearestRadialChildLabel(aura + 1, aura, kids)).toBeNull();
    expect(nearestRadialChildLabel(orbit * 3, aura, kids)).toBeNull();
  });

  it("still labels the nearest child in the gaps between icons", () => {
    const between = [
      { id: "buy", label: "Buy Ship", dist: 36 },
      { id: "fit", label: "Customize", dist: 38 },
    ];
    expect(nearestRadialChildLabel(orbit, aura, between)?.id).toBe("buy");
  });

  it("keeps the nearest child while inside the hub, not only on an icon", () => {
    expect(nearestRadialChildLabel(8, aura, kids)?.label).toBe("Buy Ship");
  });
});
