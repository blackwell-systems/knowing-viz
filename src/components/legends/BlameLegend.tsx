import { useGraphStore } from '../../store';

export function BlameLegend() {
  const blameAuthorColors = useGraphStore((s) => s.blameAuthorColors);
  const highlightedAuthor = useGraphStore((s) => s.highlightedAuthor);
  const setHighlightedAuthor = useGraphStore((s) => s.setHighlightedAuthor);

  const handleClick = (author: string) => {
    setHighlightedAuthor(highlightedAuthor === author ? null : author);
  };

  return (
    <>
      <div className="detail-label">
        Authors <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(click to filter)</span>
      </div>
      {[...blameAuthorColors.entries()].map(([author, color]) => (
        <div
          className="detail-value"
          key={author}
          onClick={() => handleClick(author)}
          style={{
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
            marginBottom: 1,
            background: highlightedAuthor === author ? 'var(--bg-tertiary)' : 'transparent',
          }}
        >
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6, verticalAlign: 'middle' }} />
          {author}
        </div>
      ))}
    </>
  );
}
