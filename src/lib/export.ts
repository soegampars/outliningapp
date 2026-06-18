import type { ArgNode, Edge, NodeType, Source, Strength, Support } from "../model/types";

// Markdown export (concept §7). Self-describing (opens with a legend) and
// lossless in the "complete" scope: strength, edge-kind, and source keys are all
// present as text so a human or LLM can reason about weakest-link and
// monoculture straight from the file. Every edge is rendered explicitly under
// "Supported by" / "Feeds into", so non-linear connections are never dropped.

export type ExportScope = "complete" | "skeleton";

export interface ExportModel {
  nodes: ArgNode[];
  edges: Edge[];
  nodeTypeById: Record<number, NodeType>;
  supports: Support[];
  sources: Source[];
  effectiveById: Record<number, Strength>;
}

// Feeders before the moves they support (Kahn's topological sort); cycles and
// leftovers are appended by id. This is the "proposed initial order" of §7 — the
// curated linear order (Step 6) will refine it.
function orderNodes(nodes: ArgNode[], edges: Edge[]): ArgNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indeg = new Map<number, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  const outAdj = new Map<number, number[]>();
  for (const e of edges) {
    if (!byId.has(e.from_id) || !byId.has(e.to_id)) continue;
    indeg.set(e.to_id, (indeg.get(e.to_id) ?? 0) + 1);
    const arr = outAdj.get(e.from_id);
    if (arr) arr.push(e.to_id);
    else outAdj.set(e.from_id, [e.to_id]);
  }
  const queue = nodes
    .filter((n) => (indeg.get(n.id) ?? 0) === 0)
    .map((n) => n.id)
    .sort((a, b) => a - b);
  const ordered: number[] = [];
  const seen = new Set<number>();
  while (queue.length) {
    const id = queue.shift() as number;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    for (const to of (outAdj.get(id) ?? []).slice().sort((a, b) => a - b)) {
      indeg.set(to, (indeg.get(to) ?? 1) - 1);
      if ((indeg.get(to) ?? 0) === 0 && !seen.has(to)) queue.push(to);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) ordered.push(n.id);
  return ordered.map((id) => byId.get(id)).filter((n): n is ArgNode => !!n);
}

const kindWord = (kind: string) => (kind === "disjunctive" ? "any-of" : "jointly-required");

export function buildExport(scope: ExportScope, m: ExportModel): string {
  const { nodes, edges, nodeTypeById, supports, sources, effectiveById } = m;
  const complete = scope === "complete";
  const typeName = (id: number) => nodeTypeById[id]?.name ?? "NODE";
  const anchor = (id: number) => `^n${id}`;

  const supportsByNode = new Map<number, Support[]>();
  for (const s of supports) {
    const a = supportsByNode.get(s.node_id);
    if (a) a.push(s);
    else supportsByNode.set(s.node_id, [s]);
  }
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const out: string[] = [];
  out.push(`# Spine export — ${complete ? "complete" : "skeleton only"}`);
  out.push("");
  out.push("> NOTATION");
  out.push("> [TYPE · strength] — node type and the author's manual strength (strong | unfinished | weak)");
  out.push("> effective: X — strength after weakest-link propagation through feeders");
  out.push("> ^nID — stable anchor for cross-references");
  if (complete) {
    out.push("> cite:key — a citation (see Sources at end); own — the author's own reasoning");
  }
  out.push("> jointly-required — all such feeders are needed (min); any-of — redundant alternatives (max)");
  out.push("");
  out.push(
    'Nodes are listed feeders-before-conclusions. Every connection is shown explicitly under "Supported by" / "Feeds into", so non-linear links are never lost.',
  );
  out.push("");

  for (const n of orderNodes(nodes, edges)) {
    const eff = effectiveById[n.id] ?? n.strength;
    out.push(
      `### [${typeName(n.type_id)} · ${n.strength}] ${n.claim || "(untitled)"}  ${anchor(n.id)}` +
        (eff !== n.strength ? `  (effective: ${eff})` : ""),
    );
    if (n.attention) out.push("⚑ attention");
    if (n.body) out.push(n.body);

    if (complete) {
      const sups = supportsByNode.get(n.id) ?? [];
      if (sups.length) {
        out.push("Supports:");
        for (const s of sups) {
          const src = s.source_id != null ? sourceById.get(s.source_id) : undefined;
          const tag = src ? `cite:${src.key}` : "own";
          out.push(`  - ${tag}${s.text ? ` — ${s.text}` : ""}`);
        }
      }
    }

    const incoming = edges.filter((e) => e.to_id === n.id);
    const outgoing = edges.filter((e) => e.from_id === n.id);
    if (incoming.length) {
      out.push(
        `Supported by: ${incoming.map((e) => `${anchor(e.from_id)} (${kindWord(e.kind)})`).join(", ")}`,
      );
    }
    if (outgoing.length) {
      out.push(`Feeds into: ${outgoing.map((e) => anchor(e.to_id)).join(", ")}`);
    }
    out.push("");
  }

  if (complete) {
    const usedKeys = new Set<string>();
    for (const s of supports) {
      if (s.source_id != null) {
        const src = sourceById.get(s.source_id);
        if (src) usedKeys.add(src.key);
      }
    }
    const used = sources.filter((s) => usedKeys.has(s.key));
    if (used.length) {
      out.push("---");
      out.push("SOURCES USED");
      out.push("");
      for (const src of used) {
        out.push(`[${src.key}]`);
        if (src.raw_bibtex) {
          out.push("```bibtex");
          out.push(src.raw_bibtex.trim());
          out.push("```");
        }
        out.push("");
      }
    }
  }

  return out.join("\n");
}
