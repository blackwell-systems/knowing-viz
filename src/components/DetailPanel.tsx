/**
 * DetailPanel: Right-panel container that switches between node detail,
 * blast detail, legend views, and galaxy 3D info based on viewMode and selectedNode.
 * Uses framer-motion AnimatePresence for the panel slide-in/out animation.
 * Ported from main.ts lines 96-185 and 497-503.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useGraphStore } from '../store';
import { NodeDetail } from './NodeDetail';
import { BlastDetail } from './BlastDetail';
import { NodeList } from './NodeList';
import { ProvenanceLegend } from './legends/ProvenanceLegend';
import { BlameLegend } from './legends/BlameLegend';
import { CoverageLegend } from './legends/CoverageLegend';

export function DetailPanel() {
  const viewMode = useGraphStore((s) => s.viewMode);
  const selectedNode = useGraphStore((s) => s.selectedNode);
  const selectNode = useGraphStore((s) => s.selectNode);

  const handleClose = () => selectNode(null);

  const showLegend = ['provenance', 'blame', 'coverage'].includes(viewMode);
  const showBlast = viewMode === 'blast-radius' && selectedNode;
  const showGalaxy3DInfo = viewMode === 'galaxy3d';
  const showNodeDetail = selectedNode && !showBlast;
  const isVisible = selectedNode || showLegend || showGalaxy3DInfo;

  const title = showBlast ? `Blast: ${selectedNode?.shortName}` :
                showLegend ? viewMode.charAt(0).toUpperCase() + viewMode.slice(1) :
                showGalaxy3DInfo ? 'Galaxy 3D' :
                selectedNode ? selectedNode.shortName : 'Nodes';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          className="detail-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="detail-header">
            <h3>{title}</h3>
            <button className="detail-close" onClick={handleClose}>&times;</button>
          </div>
          <div className="detail-body">
            <div className="selected-info">
              {showBlast && <BlastDetail />}
              {showNodeDetail && <NodeDetail />}
              {viewMode === 'provenance' && <ProvenanceLegend />}
              {viewMode === 'blame' && <BlameLegend />}
              {viewMode === 'coverage' && <CoverageLegend />}
              {showGalaxy3DInfo && (
                <>
                  <div className="detail-value">Drag to orbit, scroll to zoom</div>
                  <div className="detail-value">Auto-rotating</div>
                  <div className="detail-label" style={{ marginTop: 8 }}>Legend</div>
                  <div className="detail-value">Each cluster = one community</div>
                  <div className="detail-value"><span style={{ color: '#f85149' }}>Red lines</span> = cross-community</div>
                </>
              )}
            </div>
            <NodeList />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
