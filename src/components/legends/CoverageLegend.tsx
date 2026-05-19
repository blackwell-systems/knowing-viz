/**
 * CoverageLegend: Coverage heatmap legend for the coverage view mode.
 * Ported from main.ts lines 451-458.
 */

export function CoverageLegend() {
  const items = [
    { color: '#f85149', label: '0% (uncovered)' },
    { color: '#d29922', label: '1-49% (low)' },
    { color: '#7ee787', label: '50-79% (medium)' },
    { color: '#3fb950', label: '80-100% (high)' },
    { color: 'rgba(48,54,61,0.3)', label: 'Not measured' },
  ];
  return (
    <>
      <div className="detail-label">Coverage Legend</div>
      {items.map(({ color, label }) => (
        <div className="detail-value" key={label}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />
          {label}
        </div>
      ))}
    </>
  );
}
