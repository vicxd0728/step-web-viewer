import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Box from 'lucide-react/dist/esm/icons/box.js';
import Camera from 'lucide-react/dist/esm/icons/camera.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js';
import FileUp from 'lucide-react/dist/esm/icons/file-up.js';
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3x3.js';
import Layers from 'lucide-react/dist/esm/icons/layers.js';
import Maximize from 'lucide-react/dist/esm/icons/maximize.js';
import Moon from 'lucide-react/dist/esm/icons/moon.js';
import PanelRightClose from 'lucide-react/dist/esm/icons/panel-right-close.js';
import PanelRightOpen from 'lucide-react/dist/esm/icons/panel-right-open.js';
import Ruler from 'lucide-react/dist/esm/icons/ruler.js';
import ScanSearch from 'lucide-react/dist/esm/icons/scan-search.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import ScanLine from 'lucide-react/dist/esm/icons/scan-line.js';
import Sun from 'lucide-react/dist/esm/icons/sun.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Upload from 'lucide-react/dist/esm/icons/upload.js';
import View from 'lucide-react/dist/esm/icons/view.js';
import Waypoints from 'lucide-react/dist/esm/icons/waypoints.js';
import './styles.css';

const StepViewport = lazy(() => import('./step-viewport.jsx'));

const displayModes = [
  { id: 'shaded', label: 'Shaded', icon: Box },
  { id: 'edges', label: 'Edges', icon: Waypoints },
  { id: 'wireframe', label: 'Wire', icon: ScanLine },
];

const statusText = {
  drop: 'Waiting for STEP file',
  loading: 'Reading file',
  parsing: 'Parsing STEP',
  loaded: 'Model loaded',
  error: 'Load failed',
};

function formatLength(value) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(2)} mm`;
}

async function forceAppUpdate() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  window.location.replace(`/?update=${Date.now()}`);
}

function App() {
  const inputRef = useRef(null);
  const viewerRef = useRef(null);
  const [file, setFile] = useState(null);
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState('drop');
  const [error, setError] = useState('');
  const [displayMode, setDisplayMode] = useState('edges');
  const [activeTool, setActiveTool] = useState('orbit');
  const [showGrid, setShowGrid] = useState(true);
  const [darkCanvas, setDarkCanvas] = useState(false);
  const [stats, setStats] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [parts, setParts] = useState([]);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [showAutoDimensions, setShowAutoDimensions] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('stp-studio-update-ready', onUpdateReady);
    return () => window.removeEventListener('stp-studio-update-ready', onUpdateReady);
  }, []);

  const handleViewerError = useCallback((message) => {
    setError(message);
    setStatus('error');
  }, []);

  const onFile = useCallback(async (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setStatus('loading');
    setError('');
    setStats(null);
    setDimensions(null);
    setMeasurements([]);
    setParts([]);
    setExplodeAmount(0);
    setShowAutoDimensions(false);
    try {
      const buffer = await nextFile.arrayBuffer();
      setModel({ name: nextFile.name, buffer });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  const fileSize = useMemo(() => {
    if (!file) return 'No file';
    if (file.size > 1024 * 1024) return `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  }, [file]);

  const statusLabel = statusText[status];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/logo.svg" alt="STP Studio logo" />
          <div>
            <h1>STP Studio</h1>
            <p>3D viewing, measuring, and markup workspace</p>
          </div>
        </div>

        <div className="top-actions">
          <div className={`app-state state-${status}`}>
            <span />
            {statusLabel}
          </div>
          <button className="text-button" onClick={() => inputRef.current?.click()}>
            <Upload size={16} />
            Upload STEP
          </button>
          <button className="icon-button" title="Fit model" onClick={() => viewerRef.current?.fit()}>
            <RotateCcw size={17} />
          </button>
          <button className="icon-button" title="Screenshot" onClick={() => viewerRef.current?.capture()}>
            <Camera size={17} />
          </button>
          <button className="text-button update-action" title="Force app update" onClick={forceAppUpdate}>
            Update
          </button>
          <button
            className="icon-button panel-toggle"
            title={inspectorOpen ? 'Hide panel' : 'Show panel'}
            onClick={() => setInspectorOpen((value) => !value)}
          >
            {inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
          <button className="text-button secondary" onClick={() => viewerRef.current?.exportGlb()}>
            <Download size={16} />
            Export GLB
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="tool-rail" aria-label="Viewer tools">
          <div className="rail-group-label">FILE</div>
          <button className="rail-button active" title="Upload file" onClick={() => inputRef.current?.click()}>
            <FileUp size={20} />
          </button>
          <div className="rail-group-label">VIEW</div>
          <button className="rail-button" title="Fit view" onClick={() => viewerRef.current?.fit()}>
            <Maximize size={20} />
          </button>
          <div className="rail-group-label">TOOLS</div>
          <button
            className={`rail-button ${activeTool === 'measure' ? 'active' : ''}`}
            title="Point to point measurement"
            onClick={() => setActiveTool((tool) => (tool === 'measure' ? 'orbit' : 'measure'))}
          >
            <Ruler size={20} />
          </button>
          <button className="rail-button" title="Clear measurements" onClick={() => viewerRef.current?.clearMeasurements()}>
            <Trash2 size={20} />
          </button>
          <div className="rail-spacer" />
          <button className={`rail-button ${showGrid ? 'active' : ''}`} title="Grid" onClick={() => setShowGrid((value) => !value)}>
            <Grid3X3 size={20} />
          </button>
          <button className={`rail-button ${darkCanvas ? 'active' : ''}`} title="Dark canvas" onClick={() => setDarkCanvas((value) => !value)}>
            {darkCanvas ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </aside>

        <div
          className="viewport-wrap"
          onDrop={(event) => {
            event.preventDefault();
            onFile(event.dataTransfer.files?.[0]);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          {model ? (
            <Suspense fallback={<div className="viewport-loading">Loading 3D engine...</div>}>
              <StepViewport
                ref={viewerRef}
                model={model}
                displayMode={displayMode}
                activeTool={activeTool}
                showGrid={showGrid}
                darkCanvas={darkCanvas}
                showAutoDimensions={showAutoDimensions}
                onStatus={setStatus}
                onError={handleViewerError}
                onStats={setStats}
                onDimensions={setDimensions}
                onMeasurements={setMeasurements}
                onParts={setParts}
              />
            </Suspense>
          ) : (
            <div className="viewport-placeholder" />
          )}

          {!model && (
            <button className="drop-zone" onClick={() => inputRef.current?.click()}>
              <img src="/logo.svg" alt="" />
              <span>Drop .stp / .step here or click to upload</span>
              <small>STP Studio loads the 3D engine only after upload to keep the app fast.</small>
            </button>
          )}
          <button
            className="mobile-panel-fab"
            onClick={() => setInspectorOpen((value) => !value)}
            aria-label={inspectorOpen ? 'Hide inspector panel' : 'Show inspector panel'}
          >
            {inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            Panel
          </button>
        </div>

        {inspectorOpen && <button className="mobile-panel-backdrop" aria-label="Close panel" onClick={() => setInspectorOpen(false)} />}

        <aside className={`inspector ${inspectorOpen ? 'is-open' : ''}`}>
          <div className="inspector-mobile-header">
            <strong>Model Panel</strong>
            <button onClick={() => setInspectorOpen(false)} aria-label="Close panel">
              <PanelRightClose size={18} />
            </button>
          </div>
          <section className="panel">
            <h2>File</h2>
            <dl className="meta-list">
              <div><dt>Name</dt><dd>{file?.name ?? 'Not selected'}</dd></div>
              <div><dt>Size</dt><dd>{fileSize}</dd></div>
              <div><dt>Status</dt><dd>{statusLabel}</dd></div>
            </dl>
            {error && <p className="error">{error}</p>}
          </section>

          <section className="panel">
            <h2>Display</h2>
            <div className="segmented">
              {displayModes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    className={displayMode === mode.id ? 'selected' : ''}
                    onClick={() => setDisplayMode(mode.id)}
                    title={mode.label}
                  >
                    <Icon size={16} />
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <label className="check-row">
              <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
              Show grid
            </label>
            <label className="check-row">
              <input type="checkbox" checked={darkCanvas} onChange={(event) => setDarkCanvas(event.target.checked)} />
              Dark canvas
            </label>
          </section>

          <section className="panel">
            <h2>View</h2>
            <div className="view-grid">
              {['iso', 'front', 'right', 'top'].map((viewName) => (
                <button key={viewName} onClick={() => viewerRef.current?.setView(viewName)}>
                  <View size={14} />
                  {viewName.toUpperCase()}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Model Size</h2>
            <dl className="meta-list">
              <div><dt>X</dt><dd>{formatLength(dimensions?.x)}</dd></div>
              <div><dt>Y</dt><dd>{formatLength(dimensions?.y)}</dd></div>
              <div><dt>Z</dt><dd>{formatLength(dimensions?.z)}</dd></div>
            </dl>
            <button
              className={`wide-action ${showAutoDimensions ? 'is-active' : ''}`}
              onClick={() => setShowAutoDimensions((value) => !value)}
            >
              <ScanSearch size={15} />
              {showAutoDimensions ? 'Hide auto dimensions' : 'Show auto dimensions'}
            </button>
          </section>

          <section className="panel">
            <h2>Assembly</h2>
            <div className="assembly-actions">
              <label className="range-row">
                <span>Explode</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={explodeAmount}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setExplodeAmount(value);
                    viewerRef.current?.setExplode(value / 100);
                  }}
                />
              </label>
              <button onClick={() => {
                setExplodeAmount(0);
                viewerRef.current?.restoreAssembly();
              }}>
                Restore assembly
              </button>
            </div>
            <div className="part-list">
              {parts.length === 0 && <span>No parts detected</span>}
              {parts.map((part) => (
                <article key={part.id} className={`part-row ${part.visible ? '' : 'is-hidden'} ${part.isolated ? 'is-isolated' : ''}`}>
                  <button className="part-main" onClick={() => viewerRef.current?.focusPart(part.id)}>
                    <strong>{part.name}</strong>
                    <small>{part.triangles.toLocaleString()} triangles</small>
                  </button>
                  <button title={part.visible ? 'Hide part' : 'Show part'} onClick={() => viewerRef.current?.togglePart(part.id)}>
                    {part.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button title="Isolate part" onClick={() => viewerRef.current?.isolatePart(part.id)}>
                    Solo
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Measurements</h2>
            <p className="hint">Select the ruler, then click two points on the model.</p>
            <div className="measure-list">
              {measurements.length === 0 && <span>No measurements</span>}
              {measurements.map((item) => (
                <button key={item.id} onClick={() => viewerRef.current?.focusMeasurement(item.id)}>
                  M{item.id}: {formatLength(item.distance)}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Model Info</h2>
            <dl className="meta-list">
              <div><dt>Meshes</dt><dd>{stats?.meshes ?? '-'}</dd></div>
              <div><dt>Triangles</dt><dd>{stats?.triangles?.toLocaleString() ?? '-'}</dd></div>
              <div><dt>Edges</dt><dd>{stats?.edges?.toLocaleString() ?? '-'}</dd></div>
            </dl>
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <span><Eye size={14} /> {activeTool === 'measure' ? 'Measure mode: click two model points' : 'Orbit controls'}</span>
        <span>{statusLabel}</span>
        <span>{stats ? `${stats.triangles.toLocaleString()} triangles` : 'Ready'}</span>
      </footer>

      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept=".stp,.step"
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {updateReady && (
        <button className="update-toast" onClick={forceAppUpdate}>
          New version ready. Tap to refresh.
        </button>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      const notifyUpdate = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('stp-studio-update-ready'));
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      };
      notifyUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => notifyUpdate(registration.installing));
      setInterval(() => registration.update(), 60 * 60 * 1000);
    }).catch(() => {});
  });
}
