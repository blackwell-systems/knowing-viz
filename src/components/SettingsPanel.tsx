import { useGraphStore, type DisplaySettings } from '../store';

// ---------------------------------------------------------------------------
// SliderRow helper
// ---------------------------------------------------------------------------

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, min, max, step = 1, value, onChange }: SliderRowProps) {
  return (
    <div className="slider-row">
      <label className="slider-label">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPanel
// ---------------------------------------------------------------------------

export function SettingsPanel() {
  const settings = useGraphStore((s) => s.settings);
  const updateSettings = useGraphStore((s) => s.updateSettings);

  function update<K extends keyof DisplaySettings>(key: K, raw: number) {
    updateSettings({ [key]: raw } as Pick<DisplaySettings, K>);
  }

  return (
    <div className="settings-panel">
      <h3>Settings</h3>

      {/* Confidence: raw slider 0-100, stored as confidenceMin 0-1 */}
      <SliderRow
        label="Confidence"
        min={0}
        max={100}
        value={Math.round(settings.confidenceMin * 100)}
        onChange={(v) => updateSettings({ confidenceMin: v / 100 })}
      />

      {/* Node size: raw slider 5-30, maps to nodeScale 0.5-3.0 (factor = /10) */}
      <SliderRow
        label="Node size"
        min={5}
        max={30}
        value={Math.round(settings.nodeScale * 10)}
        onChange={(v) => updateSettings({ nodeScale: v / 10 })}
      />

      {/* Labels: 0-100 maps directly to topLabelCount */}
      <SliderRow
        label="Labels"
        min={0}
        max={100}
        value={settings.topLabelCount}
        onChange={(v) => update('topLabelCount', v)}
      />

      {/* Label size: 6-20 maps directly to labelSize */}
      <SliderRow
        label="Label size"
        min={6}
        max={20}
        value={settings.labelSize}
        onChange={(v) => update('labelSize', v)}
      />

      {/* Edges: raw slider 0-100, stored as edgeOpacity 0-1 */}
      <SliderRow
        label="Edges"
        min={0}
        max={100}
        value={Math.round(settings.edgeOpacity * 100)}
        onChange={(v) => updateSettings({ edgeOpacity: v / 100 })}
      />

      {/* Gravity: raw slider 1-50, stored as gravity 0.1-5.0 (factor = /10) */}
      <SliderRow
        label="Gravity"
        min={1}
        max={50}
        value={Math.round(settings.gravity * 10)}
        onChange={(v) => updateSettings({ gravity: v / 10 })}
      />

      {/* Spread: 5-100 maps directly to spread */}
      <SliderRow
        label="Spread"
        min={5}
        max={100}
        value={settings.spread}
        onChange={(v) => update('spread', v)}
      />

      {/* Max nodes: 50-10000 step 50, maps directly to maxNodes */}
      <SliderRow
        label="Max nodes"
        min={50}
        max={10000}
        step={50}
        value={settings.maxNodes}
        onChange={(v) => update('maxNodes', v)}
      />

      {/* Cross-community edges toggle */}
      <div className="settings-row settings-toggle">
        <label>
          <input
            type="checkbox"
            checked={settings.crossCommunityOnly}
            onChange={(e) => updateSettings({ crossCommunityOnly: e.target.checked })}
          />
          {' '}Cross-community only
        </label>
      </div>
    </div>
  );
}
