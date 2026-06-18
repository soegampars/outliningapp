import { useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useSpine } from "../state/store";
import { isGapTypeName } from "../model/gaps";
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

  const isGap = isGapTypeName(nodeTypes.find((t) => t.id === d.typeId)?.name);
  const cls =
    `spine-node strength-${d.effective}` +
    (selected ? " selected" : "") +
    (d.isBlock ? " spine-node--block" : "") +
    (isGap ? " spine-node--gap" : "") +
    (d.spineRole === "spine" ? " spine-node--onspine" : "") +
    (d.spineRole === "lateral" ? " spine-node--lateral" : "");

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
