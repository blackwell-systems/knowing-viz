import { useEffect } from 'react';
import { useGraphStore } from './store';
import { loadGraph } from './graph-data';
import { Sidebar } from './components/Sidebar';
import { GraphViewer } from './components/GraphViewer';
import { Galaxy3D } from './components/Galaxy3D';
import { StatusBar } from './components/StatusBar';
import { DetailPanel } from './components/DetailPanel';

const GRAPH_URL = import.meta.env.BASE_URL + 'graph.json';

export default function App() {
  const setGraph = useGraphStore((s) => s.setGraph);
  const graph = useGraphStore((s) => s.graph);

  useEffect(() => {
    loadGraph(GRAPH_URL)
      .then((g) => setGraph(g, 'graph.json'))
      .catch((err) => console.error('Failed to load graph:', err));
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-area">
        {graph ? (
          <>
            <GraphViewer />
            <Galaxy3D />
          </>
        ) : (
          <div className="graph-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#f85149', padding: 40, textAlign: 'center' }}>
              <h2>No graph data found</h2>
              <p>Run <code>knowing export -format json &gt; public/graph.json</code></p>
            </div>
          </div>
        )}
        <StatusBar />
      </main>
      <DetailPanel />
    </div>
  );
}
