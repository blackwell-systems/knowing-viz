export default function App() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>knowing</h1>
          <span className="subtitle">Graph Explorer</span>
        </div>
      </aside>
      <main className="main-area">
        <div className="graph-container" />
        <div className="status-bar" />
      </main>
      <aside className="detail-panel">
      </aside>
    </div>
  );
}
