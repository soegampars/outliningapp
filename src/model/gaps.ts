import type { NodeType } from "./types";

// Built-in "hole" types (concept v2-D). A gap marks a step the author knows is
// missing; a placeholder question is a slot to be filled later. These poison
// downstream *only when something rests on them* — as a spine terminus they are
// a legitimate open ending and must never be flagged. See computeEffectiveStrength.
export const GAP_TYPE_NAMES = new Set(["GAP", "OPEN GAP", "QUESTION"]);

export function isGapTypeName(name: string | null | undefined): boolean {
  return !!name && GAP_TYPE_NAMES.has(name.trim().toUpperCase());
}

// The set of gap-like type ids, from either the type list or an id->type map.
export function gapTypeIds(
  types: NodeType[] | Record<number, NodeType>,
): Set<number> {
  const list = Array.isArray(types) ? types : Object.values(types);
  const out = new Set<number>();
  for (const t of list) if (isGapTypeName(t.name)) out.add(t.id);
  return out;
}
