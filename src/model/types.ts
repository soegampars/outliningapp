// Domain model (concept §3). These mirror the SQLite rows 1:1.

export type Strength = "strong" | "unfinished" | "weak";
export type EdgeKind = "conjunctive" | "disjunctive";
export type NodeRole = "structural" | "aside";

export const STRENGTHS: Strength[] = ["strong", "unfinished", "weak"];

export interface NodeType {
  id: number;
  name: string;
  icon: string | null;
  role: NodeRole;
  sort_order: number;
  builtin: number;
}

// An argument move.
export interface ArgNode {
  id: number;
  type_id: number;
  claim: string;
  body: string;
  strength: Strength;
  attention: number; // 0 | 1
  pos_x: number;
  pos_y: number;
}

// A logical connection: from a supporting/child move -> the move it supports.
export interface Edge {
  id: number;
  from_id: number;
  to_id: number;
  kind: EdgeKind;
}

// A paper — a cache of identity, not a library (§3).
export interface Source {
  id: number;
  key: string;
  author: string | null;
  year: string | null;
  title: string | null;
  venue: string | null;
  raw_bibtex: string | null;
}

// One use of evidence on one node. source_id null => the author's own reasoning.
export interface Support {
  id: number;
  node_id: number;
  text: string;
  source_id: number | null;
  sort_order: number;
}
