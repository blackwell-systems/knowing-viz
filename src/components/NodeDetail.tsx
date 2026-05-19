/**
 * NodeDetail: Node detail view shown when a node is selected.
 * Ported from main.ts lines 119-160 (showNodeDetail + renderEdgeList).
 * Displays: qualified name, kind, package, community, signature, callers, callees.
 */

import { useMemo } from 'react';
import { useGraphStore } from '../store';
import { communityColor } from '../constants';

export function NodeDetail() {
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectedEdges = useGraphStore((s) => s.selectedEdges);
  const graph = useGraphStore((s) => s.graph);

  if (!selectedNode || !graph) return null;

  const callers = selectedEdges.filter(e => e.target === selectedNode.id);
  const callees = selectedEdges.filter(e => e.source === selectedNode.id);
  const community = graph.communities.find(c => c.id === selectedNode.community);

  // Build a node map for edge display
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const nodeMap = useMemo(() => {
    const m = new Map<string, string>();
    graph.nodes.forEach(n => m.set(n.id, n.shortName));
    return m;
  }, [graph]);

  return (
    <>
      <div className="detail-label">Qualified Name</div>
      <div className="detail-code">{selectedNode.label}</div>
      <div className="detail-label">Kind</div>
      <div className="detail-value">{selectedNode.kind}</div>
      <div className="detail-label">Package</div>
      <div className="detail-value">{selectedNode.package}</div>
      <div className="detail-label">Community</div>
      <div className="detail-value">
        <span className="community-dot" style={{
          background: communityColor(selectedNode.community),
          display: 'inline-block', width: 8, height: 8,
          borderRadius: '50%', marginRight: 4, verticalAlign: 'middle'
        }} />
        {community ? community.label : 'ungrouped'} ({community?.size || 0} symbols)
      </div>
      <div className="detail-label">Signature</div>
      <div className="detail-code">{selectedNode.signature || 'n/a'}</div>
      <div className="detail-section">
        <div className="detail-label">Callers <span className="stat-highlight">{callers.length}</span></div>
        <EdgeList edges={callers} peerField="source" nodeMap={nodeMap} />
      </div>
      <div className="detail-section">
        <div className="detail-label">Callees <span className="stat-highlight">{callees.length}</span></div>
        <EdgeList edges={callees} peerField="target" nodeMap={nodeMap} />
      </div>
    </>
  );
}

function EdgeList({ edges, peerField, nodeMap }: {
  edges: import('../graph-data').GraphEdge[];
  peerField: 'source' | 'target';
  nodeMap: Map<string, string>;
}) {
  if (edges.length === 0) return <ul className="edge-list"><li>none</li></ul>;
  return (
    <ul className="edge-list">
      {edges.slice(0, 20).map((e, i) => (
        <li key={i}>
          <span className={e.crossCommunity ? 'edge-cross' : 'edge-type'}>{e.type}</span>
          {' '}{nodeMap.get(e[peerField]) || e[peerField].slice(0, 8)}
        </li>
      ))}
      {edges.length > 20 && <li className="more">+{edges.length - 20} more</li>}
    </ul>
  );
}
