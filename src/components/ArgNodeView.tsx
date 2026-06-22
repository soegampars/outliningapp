import { useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useSpine } from "../state/store";
import { isGapTypeName } from "../model/gaps";
import { strengthMode } from "../model/strengthModes";
import type { Strength } from "../model/types";

// Data carried on each React Flow node. Derived from the model in GraphCanvas;
// `effective` is the propagated weakest-link strength that colours the node.
export interface ArgNodeData {
  claim: string;
  typeId: number;
  attention: number;
  effective: Strength;
  isBlock: boolean;
  spineRole?: "spine" | "lateral" | null;
  positionRole?: "terminus" | "output" | "section" | null;
  parked?: boolean;
  cut?: boolean;
  [key: string]: unknown;
}

export function ArgNodeView({ id, data, selected }: NodeProps) {
  const d = data as ArgNodeData;
  const nid = Number(id);
  const nodeTypes = useSpine((s) => s.nodeTypes);
  const setNodeType = useSpine((s) => s.setNodeType);
  const setNodeClaim = useSpine((s) => s.setNodeClaim);
  // Edit mode is driven by React Flow's onNodeDoubleClick (canvas-level), which
  // is reliable; RF intercepts double-clicks before they reach inner handlers.
  const editing = useSpine((s) => s.editingNodeId === nid);
  const setEditing = useSpine((s) => s.setEditing);

  const [draft, setDraft] = useState(d.claim);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    setDraft(d.claim);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }, [editing, d.claim]);

  const commit = () => {
    setEditing(null);
    if (draft !== d.claim) void setNodeClaim(nid, draft);
  };
  const cancel = () => setEditing(null);

  const typeName = nodeTypes.find((t) => t.id === d.typeId)?.name;
  const isGap = isGapTypeName(typeName);
  const isFraming = strengthMode(typeName) === "framing";
  const roleLabel =
    d.positionRole === "terminus"
      ? "lands here"
      : d.positionRole === "output"
        ? "block output"
        : d.positionRole === "section"
          ? "section"
          : null;
  const roleTitle =
    d.positionRole === "terminus"
      ? "Terminus — where the argument lands. Can be any type, including an open question."
      : d.positionRole === "output"
        ? "Block output — the conclusion this block shows one level up."
        : d.positionRole === "section"
          ? "Section conclusion — an intermediate conclusion on the main thread, not the final terminus."
          : undefined;
  const cls =
    `spine-node strength-${d.effective}` +
    (selected ? " selected" : "") +
    (d.isBlock ? " spine-node--block" : "") +
    (isGap ? " spine-node--gap" : "") +
    (d.spineRole === "spine" ? " spine-node--onspine" : "") +
    (d.spineRole === "lateral" ? " spine-node--lateral" : "") +
    (d.positionRole ? " spine-node--" + d.positionRole : "") +
    (d.parked ? " spine-node--parked" : "") +
    (isFraming ? " spine-node--framing" : "") +
    (d.cut ? " spine-node--cut" : "");

  return (
    <div className={cls}>
      <Handle type="target" position={Position.Top} />

      <div className="spine-node__head">
        <select
          className="spine-node__badge nodrag"
          value={d.typeId}
          title="Node type"
          onChange={(e) => void setNodeType(nid, Number(e.target.value))}
        >
          {nodeTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {d.isBlock ? (
          <span className="spine-node__blockmark" title="Contains an internal chain — double-click to open">
            ▸
          </span>
        ) : null}
        {d.attention ? <span className="spine-node__attention" title="Needs attention" /> : null}
        {roleLabel ? (
          <span className="spine-node__role" title={roleTitle}>
            {roleLabel}
          </span>
        ) : null}
        {d.parked ? (
          <span
            className="spine-node__role spine-node__park"
            title="Parked placeholder — something you know you need but haven't placed yet. Connect it into the argument (or change its type) to bring it in."
          >
            📌 parked
          </span>
        ) : null}
        {isFraming && !d.parked ? (
          <span
            className="spine-node__role spine-node__framemark"
            title="Problem framing — judged on its own basis; its strength does not propagate into the chain that builds on it."
          >
            framing
          </span>
        ) : null}
      </div>

      {editing && !d.isBlock ? (
        <textarea
          ref={ref}
          className="spine-node__editor nodrag nowheel"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
        />
      ) : (
        <div
          className={"spine-node__claim" + (d.claim ? "" : " spine-node__claim--empty")}
          title={d.isBlock ? "Double-click to open this block" : "Double-click to edit"}
        >
          {d.claim || (d.isBlock ? "(empty block)" : "Double-click to edit…")}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
