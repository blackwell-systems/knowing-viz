/**
 * GraphViewer: Main 2D graph view component.
 *
 * Renders the Sigma.js WebGL canvas via @react-sigma/core's SigmaContainer.
 * useGraphLoader builds the graphology Graph from store data and applies
 * current display settings. GraphEvents (a child of SigmaContainer) registers
 * event handlers and applies overlays using the Sigma context.
 *
 * This component is hidden when viewMode is 'galaxy3d' or when no graph has
 * been loaded yet.
 */

import { useMemo } from 'react';
import { SigmaContainer } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import { useGraphStore } from '../store';
import { useGraphLoader } from '../hooks/useGraphLoader';
import { GraphEvents } from './GraphEvents';

export function GraphViewer() {
  const viewMode = useGraphStore((s) => s.viewMode);
  const sigmaGraph = useGraphStore((s) => s.sigmaGraph);
  const settings = useGraphStore((s) => s.settings);

  useGraphLoader();

  const sigmaSettings = useMemo(
    () => ({
      defaultEdgeType: 'arrow' as const,
      renderEdgeLabels: false,
      labelRenderedSizeThreshold: 8,
      labelColor: { color: '#c9d1d9' },
      labelFont: `${settings.labelSize}px -apple-system, BlinkMacSystemFont, sans-serif`,
      labelWeight: 'bold',
      defaultNodeColor: '#58a6ff',
      defaultEdgeColor: '#30363d',
      stagePadding: 40,
      zIndex: true,
      minCameraRatio: 0.08,
      maxCameraRatio: 8,
    }),
    [settings.labelSize],
  );

  if (viewMode === 'galaxy3d' || !sigmaGraph) return null;

  return (
    <SigmaContainer
      graph={sigmaGraph}
      settings={sigmaSettings}
      className="graph-container"
      style={{ flex: 1 }}
    >
      <GraphEvents />
    </SigmaContainer>
  );
}
