/**
 * Modular grouping system for graph visualization.
 *
 * Each grouping strategy is a function that takes a KnowingGraph and a
 * graphology Graph instance, and returns a Map<nodeId, groupLabel>.
 * To add a new algorithm, define a GroupingFn and register it in GROUPING_REGISTRY.
 */

import type { KnowingGraph } from './graph-data';
import type Graph from 'graphology';
import louvain from 'graphology-communities-louvain';
import { connectedComponents } from 'graphology-components';

export type GroupingFn = (knGraph: KnowingGraph, sigmaGraph: Graph) => Map<string, string>;

// ---------------------------------------------------------------------------
// Built-in grouping strategies
// ---------------------------------------------------------------------------

/** Group by Go/TS package extracted from qualified name. */
const groupByPackage: GroupingFn = (knGraph) => {
  const result = new Map<string, string>();
  for (const n of knGraph.nodes) {
    result.set(n.id, n.package || 'unknown');
  }
  return result;
};

/** Group by community ID from the knowing export (server-side Louvain). */
const groupByCommunity: GroupingFn = (knGraph) => {
  const result = new Map<string, string>();
  const commLabelMap = new Map<number, string>();
  for (const c of knGraph.communities) {
    commLabelMap.set(c.id, c.label);
  }
  for (const n of knGraph.nodes) {
    result.set(n.id, commLabelMap.get(n.community) || `community ${n.community}`);
  }
  return result;
};

/** Group by git blame author. */
const groupByAuthor: GroupingFn = (knGraph) => {
  const result = new Map<string, string>();
  for (const n of knGraph.nodes) {
    result.set(n.id, n.lastAuthor || 'unknown');
  }
  return result;
};

/** Client-side Louvain on the current sigma graph (may differ from server-side). */
const groupByLouvainLive: GroupingFn = (_knGraph, sigmaGraph) => {
  const result = new Map<string, string>();
  if (sigmaGraph.order === 0) return result;
  try {
    const communities = louvain(sigmaGraph, { resolution: 0.5 });
    for (const [nodeId, communityId] of Object.entries(communities)) {
      result.set(nodeId, `cluster ${communityId}`);
    }
  } catch {
    // Fallback if louvain fails (e.g. empty graph)
    sigmaGraph.forEachNode((id) => result.set(id, 'ungrouped'));
  }
  return result;
};

/** Group by connected component (finds isolated subsystems). */
const groupByComponent: GroupingFn = (_knGraph, sigmaGraph) => {
  const result = new Map<string, string>();
  if (sigmaGraph.order === 0) return result;
  try {
    const components = connectedComponents(sigmaGraph);
    components.forEach((nodeIds, i) => {
      const label = components.length <= 20 ? `component ${i + 1}` : `comp ${i + 1}`;
      for (const id of nodeIds) {
        result.set(id, label);
      }
    });
  } catch {
    sigmaGraph.forEachNode((id) => result.set(id, 'ungrouped'));
  }
  return result;
};

/** Group by symbol kind (function, type, service, etc.). */
const groupByKind: GroupingFn = (knGraph) => {
  const result = new Map<string, string>();
  for (const n of knGraph.nodes) {
    result.set(n.id, n.kind || 'unknown');
  }
  return result;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface GroupingStrategy {
  id: string;
  label: string;
  fn: GroupingFn;
}

export const GROUPING_REGISTRY: GroupingStrategy[] = [
  { id: 'package', label: 'Package', fn: groupByPackage },
  { id: 'community', label: 'Community', fn: groupByCommunity },
  { id: 'author', label: 'Author', fn: groupByAuthor },
  { id: 'louvain-live', label: 'Louvain (live)', fn: groupByLouvainLive },
  { id: 'component', label: 'Components', fn: groupByComponent },
  { id: 'kind', label: 'Kind', fn: groupByKind },
];

export function getGroupingFn(id: string): GroupingFn {
  const strategy = GROUPING_REGISTRY.find((s) => s.id === id);
  return strategy?.fn ?? groupByPackage;
}
