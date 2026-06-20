import type { ArgNode, Edge, NodeType, Source, Strength, Support } from "../model/types";
import { topoOrderIds } from "../model/order";

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

const kindWord = (kind: string) => (kind === "disjunctive" ? "any-of" : "jointly-required");

// Resolve the reading order: the curated linear order when given, else the
// proposed topological order. Any nodes missing from a curated order are
// appended so nothing is dropped (§7 linearisation rule).
function resolveOrder(nodes: ArgNode[], edges: Edge[], orderIds?: number[]): ArgNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const base = orderIds && orderIds.length ? orderIds : topoOrderIds(nodes, edges);
  const out: ArgNode[] = [];
  const placed = new Set<number>();
  for (const id of base) {
    const n = byId.get(id);
    if (n && !placed.has(id)) {
      out.push(n);
      placed.add(id);
    }
  }
  for (const n of nodes) if (!placed.has(n.id)) out.push(n);
  return out;
}

export function buildExport(scope: ExportScope, m: ExportModel, orderIds?: number[]): string {
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
    out.push("> [for] / [against] — the support argues for or against the claim (debate)");
  }
  out.push("> jointly-required — all such feeders are needed (min); any-of — redundant alternatives (max)");
  out.push("");
  out.push(
    'Nodes are in reading order. Every connection is shown explicitly under "Supported by" / "Feeds into", so non-linear links are never lost.',
  );
  out.push("");

  for (const n of resolveOrder(nodes, edges, orderIds)) {
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
          const stance = s.stance === "for" ? "[for] " : s.stance === "against" ? "[against] " : "";
          out.push(`  - ${stance}${tag}${s.text ? ` — ${s.text}` : ""}`);
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
