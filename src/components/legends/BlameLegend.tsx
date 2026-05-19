/**
 * BlameLegend: Author color legend for the blame view mode.
 * Ported from main.ts lines 416-443.
 * Shows author colors read from the store (populated by useOverlayEffects).
 */

import { useGraphStore } from '../../store';

export function BlameLegend() {
  const blameAuthorColors = useGraphStore((s) => s.blameAuthorColors);
  // TODO: add highlightAuthor action to store, called when author clicked

  return (
    <>
      <div className="detail-label">
        Authors <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(click to filter)</span>
      </div>
      {[...blameAuthorColors.entries()].map(([author, color]) => (
        <div className="detail-value" key={author} style={{ cursor: 'pointer', padding: '2px 4px', borderRadius: 3, marginBottom: 1 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />
          {author}
        </div>
      ))}
    </>
  );
}
