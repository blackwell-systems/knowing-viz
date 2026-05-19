/**
 * Shared color constants and utilities for community/group coloring.
 *
 * Extracted from the duplicated COMMUNITY_COLORS arrays in galaxy.ts and
 * other modules so all consumers use the same palette.
 */

export const COMMUNITY_COLORS: string[] = [
  '#3fb950', '#58a6ff', '#d29922', '#bc8cff',
  '#39d2c0', '#f85149', '#7ee787', '#79c0ff',
  '#a5d6ff', '#ffd33d', '#56d4dd', '#ff7b72',
  '#8b949e', '#d2a8ff', '#2ea043', '#e3b341',
];

/**
 * Returns a deterministic color for a community/group id by cycling through
 * the COMMUNITY_COLORS palette.
 */
export function communityColor(id: number): string {
  return COMMUNITY_COLORS[id % COMMUNITY_COLORS.length];
}
