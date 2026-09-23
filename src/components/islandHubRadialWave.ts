/** Proximity swell for island-hub radial children (same idea as Market tabs). */
export const RADIAL_ORBIT_WAVE_RANGE = 150;
export const RADIAL_ORBIT_WAVE_PEAK = 1.32;
/** Label stays visible this far past the orbit radius (parent-center distance). */
export const RADIAL_ORBIT_LABEL_AURA = 1.85;

export type RadialOrbitChildDist = {
  id: string;
  label: string;
  dist: number;
};

export function radialOrbitWaveScale(distance: number): number {
  const t = Math.max(0, 1 - distance / RADIAL_ORBIT_WAVE_RANGE);
  const eased = t * t * (3 - 2 * t);
  return 1 + (RADIAL_ORBIT_WAVE_PEAK - 1) * eased;
}

export function radialOrbitAuraRadius(orbitRadius: number): number {
  return Math.max(0, orbitRadius) * RADIAL_ORBIT_LABEL_AURA;
}

/**
 * Nearest child's label while the pointer is inside the orbit aura.
 * Far outside the aura → null (hide). Gaps between icons still resolve to a neighbor.
 */
export function nearestRadialChildLabel(
  distFromParent: number,
  auraRadius: number,
  children: readonly RadialOrbitChildDist[],
): RadialOrbitChildDist | null {
  if (children.length === 0 || distFromParent > auraRadius) {
    return null;
  }
  let nearest = children[0];
  for (let i = 1; i < children.length; i += 1) {
    const child = children[i];
    if (child.dist < nearest.dist) {
      nearest = child;
    }
  }
  return nearest;
}
