/**
 * BlastDetail: Blast radius detail view for the blast-radius view mode.
 * Ported from main.ts lines 162-184.
 * Displays affected symbols grouped by BFS depth.
 */

import { useMemo } from 'react';
import { useGraphStore } from '../store';
import { computeBlastRadius } from '../blast-radius';

export function BlastDetail() {
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const graph = useGraphStore((s) => s.graph);

  const result = useMemo(() => {
    if (!selectedNode || !graph) return null;
    return computeBlastRadius(graph, selectedNode.id, 4);
  }, [selectedNode, graph]);

  if (!result || !selectedNode || !graph) return null;

  // Build node name map
  const nodeMap = new Map<string, string>();
  graph.nodes.forEach(n => nodeMap.set(n.id, n.shortName));

  // Group by depth
  const byDepth = new Map<number, string[]>();
  for (const [id, depth] of result.affected) {
    if (depth === 0) continue;
    const list = byDepth.get(depth) || [];
    list.push(nodeMap.get(id) || id.slice(0, 8));
    byDepth.set(depth, list);
  }

  return (
    <>
      <div className="detail-label">Center</div>
      <div className="detail-code">{selectedNode.label}</div>
      <div className="detail-label">Total Affected</div>
      <div className="detail-value">
        <span className="stat-danger">{result.affected.size - 1}</span> symbols
      </div>
      {[...byDepth.entries()].sort(([a], [b]) => a - b).map(([depth, names]) => (
        <div className="detail-section" key={depth}>
          <div className="detail-label">
            Depth {depth} <span className="stat-highlight">{names.length}</span>
          </div>
          <ul className="edge-list">
            {names.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      ))}
    </>
  );
}
