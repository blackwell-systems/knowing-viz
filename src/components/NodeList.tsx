/**
 * NodeList: Browsable, filterable list of all nodes in the graph.
 * Ported from main.ts lines 196-278.
 * Each node item is clickable to select it in the store.
 * Note: Camera centering on click is deferred to the integration wave.
 */

import { useMemo, useState } from 'react';
import { useGraphStore } from '../store';
import { communityColor } from '../constants';

export function NodeList() {
  const graph = useGraphStore((s) => s.graph);
  const selectNode = useGraphStore((s) => s.selectNode);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const [filter, setFilter] = useState('');

  const sortedNodes = useMemo(() => {
    if (!graph) return [];
    return [...graph.nodes].sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [graph]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return sortedNodes;
    const q = filter.toLowerCase().trim();
    return sortedNodes.filter(n =>
      n.shortName.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)
    );
  }, [sortedNodes, filter]);

  const handleClick = (node: typeof sortedNodes[0]) => {
    const edges = graph?.edges.filter(e => e.source === node.id || e.target === node.id) ?? [];
    selectNode(node, edges);
  };

  return (
    <div className="node-list-container">
      <input
        type="text"
        className="node-filter"
        placeholder="Filter nodes..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="node-list">
        {filtered.map((node) => (
          <div
            key={node.id}
            className={`node-list-item ${selectedNode?.id === node.id ? 'active' : ''}`}
            onClick={() => handleClick(node)}
          >
            <span className="node-list-dot" style={{ background: communityColor(node.community) }} />
            <span>{node.shortName}</span>
            <span className="node-list-kind">{node.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
