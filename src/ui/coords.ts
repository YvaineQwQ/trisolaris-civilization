/** Helpers for reading the player-observed 3D coordinates.
 *
 * Physics uses X (horizontal), Y (vertical height) and Z (depth). The 2D main
 * view is the X-Z top-down projection; Y is shown as an explicit annotation and
 * in the 3D auxiliary view. Never invents a component that was not measured.
 */
import type { ObservedPlanetView, ObservedStarView } from "../game/viewTypes";

export interface Coord3 {
  x: number | null;
  y: number | null;
  z: number | null;
}

export function readStarCoords(star: ObservedStarView): Coord3 {
  if (!star.known.position) return { x: null, y: null, z: null };
  return { x: star.pos.x, y: star.height, z: star.pos.z };
}

export function readPlanetCoords(planet: ObservedPlanetView): Coord3 {
  return { x: planet.pos.x, y: planet.height, z: planet.pos.z };
}

/** 2D map point: X horizontal, Z depth (Y height is a separate annotation). */
export function projectXZ(coords: Coord3): { x: number; z: number } | null {
  if (coords.x == null || coords.z == null) return null;
  return { x: coords.x, z: coords.z };
}

export function coordText(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "— 未观测";
  return (value >= 0 ? "+" : "") + value.toFixed(3);
}

/** Inclination is stored in radians; display in degrees. */
export function inclinationText(inclination: number | null): string {
  if (inclination == null || !Number.isFinite(inclination)) return "— 未观测";
  return ((inclination * 180) / Math.PI).toFixed(2) + "°";
}
