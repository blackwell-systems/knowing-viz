/**
 * StatusBar: Bottom status bar showing graph statistics.
 *
 * Ports the updateStats() display logic from main.ts (lines 76-89) into a
 * declarative React component. Reads the KnowingGraph from the Zustand store
 * and derives stats via graphStats(). Renders nothing meaningful until a graph
 * is loaded.
 */

import { useGraphStore } from '../store';
import { graphStats } from '../graph-data';

export function StatusBar() {
  const graph = useGraphStore((s) => s.graph);

  if (!graph) return <div className="status-bar" />;

  const stats = graphStats(graph);

  return (
    <div className="status-bar">
      <span>Nodes: {stats.nodes.toLocaleString()}</span>
      <span>Edges: {stats.edges.toLocaleString()}</span>
      <span>Communities: {stats.communities}</span>
      <span>Cross-community: {stats.crossCommunityEdges.toLocaleString()}</span>
      <span className="edge-legend">
        <span className="edge-legend-item">
          <span
            className="edge-legend-line"
            style={{ background: 'rgba(100,116,139,0.5)' }}
          />
          within group
        </span>
        <span className="edge-legend-item">
          <span className="edge-legend-line" style={{ background: '#f85149' }} />
          cross-group
        </span>
      </span>
    </div>
  );
}
