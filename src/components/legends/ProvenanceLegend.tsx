/**
 * ProvenanceLegend: Color legend for the provenance view mode.
 * Ported from main.ts lines 406-411.
 */

import { PROVENANCE_COLORS } from '../../provenance';

export function ProvenanceLegend() {
  return (
    <>
      <div className="detail-label">Provenance Legend</div>
      {Object.entries(PROVENANCE_COLORS)
        .filter(([prov]) => prov !== 'default')
        .map(([prov, color]) => (
          <div className="detail-value" key={prov}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />
            {prov}
          </div>
        ))}
    </>
  );
}
