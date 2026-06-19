import type { NodeType, Strength } from "./types";

// How a node type's strength is determined (concept v3). Most types are `manual`
// — the author sets the strength. `derived` types (conclusions, implications)
// have no strength of their own: it is computed entirely from their premises.
// `framing` types (the problem framing a paper rests on) are judged on a separate
// basis and do not propagate their weakness into the chain that builds on them.
export type StrengthMode = "manual" | "derived" | "framing";

const DERIVED_NAMES = new Set(["CONCLUSION", "IMPLICATION", "REDUCTIO"]);
const FRAMING_NAMES = new Set(["PROBLEM FRAMING"]);

export function strengthMode(name: string | null | undefined): StrengthMode {
  if (!name) return "manual";
  const n = name.trim().toUpperCase();
  if (FRAMING_NAMES.has(n)) return "framing";
  if (DERIVED_NAMES.has(n)) return "derived";
  return "manual";
}

function idsForMode(
  types: NodeType[] | Record<number, NodeType>,
  mode: StrengthMode,
): Set<number> {
  const list = Array.isArray(types) ? types : Object.values(types);
  const out = new Set<number>();
  for (const t of list) if (strengthMode(t.name) === mode) out.add(t.id);
  return out;
}

export function derivedTypeIds(types: NodeType[] | Record<number, NodeType>): Set<number> {
  return idsForMode(types, "derived");
}

export function framingTypeIds(types: NodeType[] | Record<number, NodeType>): Set<number> {
  return idsForMode(types, "framing");
}

// Framing nodes keep the three underlying values but read on their own scale —
// they are about how well-posed the framing is, not how well-supported a claim.
const FRAMING_LABELS: Record<Strength, string> = {
  strong: "solid",
  unfinished: "provisional",
  weak: "shaky",
};

export function framingLabel(s: Strength): string {
  return FRAMING_LABELS[s];
}
