import { useReactFlow } from "@xyflow/react";
import { useSpine } from "../state/store";

// Floating toolbar shown when 2+ nodes are selected: align, distribute, and gather
// (pack scattered boxes into a tight, non-overlapping cluster). Positions are
// computed from React Flow's measured sizes, then written through the store.

type Box = { id: number; x: number; y: number; w: number; h: number };
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

export function ArrangeToolbar() {
  const selectedNodeIds = useSpine((s) => s.selectedNodeIds);
  const setNodePositions = useSpine((s) => s.setNodePositions);
  const { getNodes } = useReactFlow();

  if (selectedNodeIds.length < 2) return null;

  const apply = (kind: string) => {
    const sel = new Set(selectedNodeIds);
    const boxes: Box[] = getNodes()
      .filter((n) => sel.has(Number(n.id)))
      .map((n) => ({
        id: Number(n.id),
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? 180,
        h: n.measured?.height ?? 70,
      }));
    if (boxes.length < 2) return;

    let updates: { id: number; x: number; y: number }[] = [];
    switch (kind) {
      case "left": {
        const x = Math.min(...boxes.map((b) => b.x));
        updates = boxes.map((b) => ({ id: b.id, x, y: b.y }));
        break;
      }
      case "right": {
        const r = Math.max(...boxes.map((b) => b.x + b.w));
        updates = boxes.map((b) => ({ id: b.id, x: r - b.w, y: b.y }));
        break;
      }
      case "hcenter": {
        const c = avg(boxes.map((b) => b.x + b.w / 2));
        updates = boxes.map((b) => ({ id: b.id, x: c - b.w / 2, y: b.y }));
        break;
      }
      case "top": {
        const y = Math.min(...boxes.map((b) => b.y));
        updates = boxes.map((b) => ({ id: b.id, x: b.x, y }));
        break;
      }
      case "bottom": {
        const btm = Math.max(...boxes.map((b) => b.y + b.h));
        updates = boxes.map((b) => ({ id: b.id, x: b.x, y: btm - b.h }));
        break;
      }
      case "vcenter": {
        const c = avg(boxes.map((b) => b.y + b.h / 2));
        updates = boxes.map((b) => ({ id: b.id, x: b.x, y: c - b.h / 2 }));
        break;
      }
      case "dist-h": {
        const s = [...boxes].sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));
        const c0 = s[0].x + s[0].w / 2;
        const cN = s[s.length - 1].x + s[s.length - 1].w / 2;
        const step = (cN - c0) / (s.length - 1);
        updates = s.map((b, i) => ({ id: b.id, x: c0 + i * step - b.w / 2, y: b.y }));
        break;
      }
      case "dist-v": {
        const s = [...boxes].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
        const c0 = s[0].y + s[0].h / 2;
        const cN = s[s.length - 1].y + s[s.length - 1].h / 2;
        const step = (cN - c0) / (s.length - 1);
        updates = s.map((b, i) => ({ id: b.id, x: b.x, y: c0 + i * step - b.h / 2 }));
        break;
      }
      case "gather": {
        const n = boxes.length;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const cw = 210;
        const ch = 100;
        const cx = avg(boxes.map((b) => b.x + b.w / 2));
        const cy = avg(boxes.map((b) => b.y + b.h / 2));
        const startX = cx - (cols * cw) / 2;
        const startY = cy - (rows * ch) / 2;
        updates = boxes.map((b, i) => ({
          id: b.id,
          x: startX + (i % cols) * cw,
          y: startY + Math.floor(i / cols) * ch,
        }));
        break;
      }
    }
    void setNodePositions(updates);
  };

  return (
    <div className="arrange-toolbar">
      <span className="arrange-toolbar__count">{selectedNodeIds.length} selected</span>
      <button className="arrange-toolbar__primary" title="Gather into a tight cluster" onClick={() => apply("gather")}>
        ⊞ Gather
      </button>
      <span className="arrange-toolbar__sep" />
      <button title="Align left edges" onClick={() => apply("left")}>⊢</button>
      <button title="Align horizontal centres" onClick={() => apply("hcenter")}>↔</button>
      <button title="Align right edges" onClick={() => apply("right")}>⊣</button>
      <span className="arrange-toolbar__sep" />
      <button title="Align top edges" onClick={() => apply("top")}>⊤</button>
      <button title="Align vertical centres" onClick={() => apply("vcenter")}>↕</button>
      <button title="Align bottom edges" onClick={() => apply("bottom")}>⊥</button>
      <span className="arrange-toolbar__sep" />
      <button title="Distribute horizontally" onClick={() => apply("dist-h")}>⇿</button>
      <button title="Distribute vertically" onClick={() => apply("dist-v")}>⤧</button>
    </div>
  );
}
