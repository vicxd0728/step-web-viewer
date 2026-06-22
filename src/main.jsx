import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.js';
import Box from 'lucide-react/dist/esm/icons/box.js';
import Camera from 'lucide-react/dist/esm/icons/camera.js';
import Circle from 'lucide-react/dist/esm/icons/circle.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Eraser from 'lucide-react/dist/esm/icons/eraser.js';
import Eye from 'lucide-react/dist/esm/icons/eye.js';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off.js';
import FileImage from 'lucide-react/dist/esm/icons/file-image.js';
import FileUp from 'lucide-react/dist/esm/icons/file-up.js';
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3x3.js';
import Hand from 'lucide-react/dist/esm/icons/hand.js';
import Image from 'lucide-react/dist/esm/icons/image.js';
import Layers from 'lucide-react/dist/esm/icons/layers.js';
import Maximize from 'lucide-react/dist/esm/icons/maximize.js';
import Minus from 'lucide-react/dist/esm/icons/minus.js';
import Moon from 'lucide-react/dist/esm/icons/moon.js';
import PanelRightClose from 'lucide-react/dist/esm/icons/panel-right-close.js';
import PanelRightOpen from 'lucide-react/dist/esm/icons/panel-right-open.js';
import Ruler from 'lucide-react/dist/esm/icons/ruler.js';
import ScanSearch from 'lucide-react/dist/esm/icons/scan-search.js';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import Rotate3D from 'lucide-react/dist/esm/icons/rotate-3d.js';
import Scan from 'lucide-react/dist/esm/icons/scan.js';
import ScanLine from 'lucide-react/dist/esm/icons/scan-line.js';
import Square from 'lucide-react/dist/esm/icons/square.js';
import Sun from 'lucide-react/dist/esm/icons/sun.js';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2.js';
import Type from 'lucide-react/dist/esm/icons/type.js';
import Upload from 'lucide-react/dist/esm/icons/upload.js';
import View from 'lucide-react/dist/esm/icons/view.js';
import Waypoints from 'lucide-react/dist/esm/icons/waypoints.js';
import './styles.css';

const StepViewport = lazy(() => import('./step-viewport.jsx'));

const displayModes = [
  { id: 'shaded', label: 'Shaded', icon: Box },
  { id: 'edges', label: 'Edges', icon: Waypoints },
  { id: 'flat', label: 'Flat', icon: Layers },
  { id: 'xray', label: 'X-Ray', icon: Eye },
  { id: 'hidden', label: 'Hidden', icon: Scan },
  { id: 'wireframe', label: 'Wire', icon: ScanLine },
];

const markupTools = [
  { id: 'draw-line', label: 'Line', icon: Minus },
  { id: 'draw-arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'draw-rect', label: 'Rect', icon: Square },
  { id: 'draw-circle', label: 'Circle', icon: Circle },
  { id: 'draw-text', label: 'Text', icon: Type },
];

const toolText = {
  orbit: 'Orbit controls',
  pan: 'Pan mode: drag to move view',
  measure: 'Measure mode: click two model points',
  'draw-line': 'Markup line: drag on the view',
  'draw-arrow': 'Markup arrow: drag on the view',
  'draw-rect': 'Markup rectangle: drag on the view',
  'draw-circle': 'Markup circle: drag on the view',
  'draw-text': 'Markup text: tap the view',
};

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

function isMarkupTool(tool) {
  return tool.startsWith('draw-');
}

function normalizePoint(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100),
    y: Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100),
  };
}

function downloadTextFile(fileName, text, type = 'image/svg+xml') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function renderMarkupSvg(markups) {
  const body = markups.map((item) => {
    const { start, end } = item;
    if (item.type === 'draw-text') {
      return `<text x="${start.x.toFixed(3)}" y="${start.y.toFixed(3)}" fill="#ffb020" font-family="Segoe UI, Arial, sans-serif" font-size="3.2" font-weight="700">${item.text.replace(/[<>&"]/g, '')}</text>`;
    }
    if (item.type === 'draw-rect') {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      return `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${Math.abs(end.x - start.x).toFixed(3)}" height="${Math.abs(end.y - start.y).toFixed(3)}" fill="none" stroke="#ffb020" stroke-width="0.45"/>`;
    }
    if (item.type === 'draw-circle') {
      return `<ellipse cx="${((start.x + end.x) / 2).toFixed(3)}" cy="${((start.y + end.y) / 2).toFixed(3)}" rx="${(Math.abs(end.x - start.x) / 2).toFixed(3)}" ry="${(Math.abs(end.y - start.y) / 2).toFixed(3)}" fill="none" stroke="#ffb020" stroke-width="0.45"/>`;
    }
    const marker = item.type === 'draw-arrow' ? ' marker-end="url(#arrow)"' : '';
    return `<line x1="${start.x.toFixed(3)}" y1="${start.y.toFixed(3)}" x2="${end.x.toFixed(3)}" y2="${end.y.toFixed(3)}" stroke="#ffb020" stroke-width="0.45" stroke-linecap="round"${marker}/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#ffb020"/></marker></defs>${body}</svg>`;
}

function makeEdgeSvg(edgeRows, width, height) {
  const scale = 100 / Math.max(width, height);
  const offsetX = (100 - width * scale) / 2;
  const offsetY = (100 - height * scale) / 2;
  const paths = edgeRows.map((row) => row.map(([x1, x2, y]) => {
    const x = offsetX + x1 * scale;
    const yPos = offsetY + y * scale;
    const w = Math.max((x2 - x1 + 1) * scale, 0.12);
    return `<path d="M${x.toFixed(3)} ${yPos.toFixed(3)}h${w.toFixed(3)}" />`;
  }).join('')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/><g fill="none" stroke="#111820" stroke-width="0.16" stroke-linecap="round">${paths}</g></svg>`;
}

function MarkupShape({ item }) {
  const { start, end } = item;
  if (item.type === 'draw-text') {
    return (
      <text x={start.x} y={start.y} className="markup-text">
        {item.text}
      </text>
    );
  }
  if (item.type === 'draw-rect') {
    return (
      <rect
        x={Math.min(start.x, end.x)}
        y={Math.min(start.y, end.y)}
        width={Math.abs(end.x - start.x)}
        height={Math.abs(end.y - start.y)}
        className="markup-stroke"
      />
    );
  }
  if (item.type === 'draw-circle') {
    return (
      <ellipse
        cx={(start.x + end.x) / 2}
        cy={(start.y + end.y) / 2}
        rx={Math.abs(end.x - start.x) / 2}
        ry={Math.abs(end.y - start.y) / 2}
        className="markup-stroke"
      />
    );
  }
  return (
    <line
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      className="markup-stroke"
      markerEnd={item.type === 'draw-arrow' ? 'url(#markup-arrow)' : undefined}
    />
  );
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
  const photoInputRef = useRef(null);
  const markupLayerRef = useRef(null);
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
  const [markups, setMarkups] = useState([]);
  const [draftMarkup, setDraftMarkup] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoSvg, setPhotoSvg] = useState('');
  const [photoThreshold, setPhotoThreshold] = useState(58);
  const [photoStatus, setPhotoStatus] = useState('No photo selected');

  useEffect(() => {
    const onUpdateReady = () => setUpdateReady(true);
    window.addEventListener('stp-studio-update-ready', onUpdateReady);
    return () => window.removeEventListener('stp-studio-update-ready', onUpdateReady);
  }, []);

  const handleViewerError = useCallback((message) => {
    setError(message);
    setStatus('error');
  }, []);

  const processPhotoTo2d = useCallback(async (nextFile, threshold = photoThreshold) => {
    if (!nextFile) return;
    setPhotoFile(nextFile);
    setPhotoStatus('Processing photo');
    const url = URL.createObjectURL(nextFile);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      const maxSize = 720;
      const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < gray.length; i += 1) {
        const p = i * 4;
        gray[i] = Math.round((imageData.data[p] * 0.299) + (imageData.data[p + 1] * 0.587) + (imageData.data[p + 2] * 0.114));
      }
      const output = context.createImageData(width, height);
      const rows = [];
      for (let y = 1; y < height - 1; y += 1) {
        const row = [];
        let runStart = -1;
        for (let x = 1; x < width - 1; x += 1) {
          const i = y * width + x;
          const gx = -gray[i - width - 1] - (2 * gray[i - 1]) - gray[i + width - 1]
            + gray[i - width + 1] + (2 * gray[i + 1]) + gray[i + width + 1];
          const gy = -gray[i - width - 1] - (2 * gray[i - width]) - gray[i - width + 1]
            + gray[i + width - 1] + (2 * gray[i + width]) + gray[i + width + 1];
          const edge = Math.sqrt((gx * gx) + (gy * gy)) > threshold;
          const p = i * 4;
          const color = edge ? 18 : 255;
          output.data[p] = color;
          output.data[p + 1] = color;
          output.data[p + 2] = color;
          output.data[p + 3] = 255;
          if (edge && runStart === -1) runStart = x;
          if ((!edge || x === width - 2) && runStart !== -1) {
            row.push([runStart, edge && x === width - 2 ? x : x - 1, y]);
            runStart = -1;
          }
        }
        if (row.length) rows.push(row);
      }
      context.putImageData(output, 0, 0);
      setPhotoPreview(canvas.toDataURL('image/png'));
      setPhotoSvg(makeEdgeSvg(rows, width, height));
      setPhotoStatus(`2D outline ready (${width} x ${height})`);
    } catch (err) {
      setPhotoPreview('');
      setPhotoSvg('');
      setPhotoStatus(err instanceof Error ? err.message : String(err));
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [photoThreshold]);

  useEffect(() => {
    if (!photoFile) return;
    const timer = window.setTimeout(() => processPhotoTo2d(photoFile, photoThreshold), 180);
    return () => window.clearTimeout(timer);
  }, [photoThreshold, photoFile, processPhotoTo2d]);

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

  const beginMarkup = useCallback((event) => {
    if (!isMarkupTool(activeTool) || !markupLayerRef.current) return;
    const point = normalizePoint(event, markupLayerRef.current);
    event.preventDefault();
    if (activeTool === 'draw-text') {
      const text = window.prompt('Markup text');
      if (!text?.trim()) return;
      setMarkups((items) => [...items, {
        id: crypto.randomUUID(),
        type: activeTool,
        start: point,
        end: point,
        text: text.trim(),
      }]);
      return;
    }
    setDraftMarkup({
      id: crypto.randomUUID(),
      type: activeTool,
      start: point,
      end: point,
    });
  }, [activeTool]);

  const updateMarkup = useCallback((event) => {
    if (!draftMarkup || !markupLayerRef.current) return;
    const point = normalizePoint(event, markupLayerRef.current);
    event.preventDefault();
    setDraftMarkup((item) => item ? { ...item, end: point } : item);
  }, [draftMarkup]);

  const finishMarkup = useCallback(() => {
    if (!draftMarkup) return;
    const distance = Math.hypot(draftMarkup.end.x - draftMarkup.start.x, draftMarkup.end.y - draftMarkup.start.y);
    if (distance > 0.8) setMarkups((items) => [...items, draftMarkup]);
    setDraftMarkup(null);
  }, [draftMarkup]);

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
            className={`rail-button ${activeTool === 'orbit' ? 'active' : ''}`}
            title="Orbit"
            onClick={() => setActiveTool('orbit')}
          >
            <Rotate3D size={20} />
          </button>
          <button
            className={`rail-button ${activeTool === 'pan' ? 'active' : ''}`}
            title="Pan"
            onClick={() => setActiveTool('pan')}
          >
            <Hand size={20} />
          </button>
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
          <div className="rail-group-label">MARKUP</div>
          {markupTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                className={`rail-button ${activeTool === tool.id ? 'active' : ''}`}
                title={tool.label}
                onClick={() => setActiveTool((current) => (current === tool.id ? 'orbit' : tool.id))}
              >
                <Icon size={20} />
              </button>
            );
          })}
          <button className="rail-button" title="Clear markup" onClick={() => {
            setMarkups([]);
            setDraftMarkup(null);
          }}>
            <Eraser size={20} />
          </button>
          <div className="rail-group-label">2D</div>
          <button className="rail-button" title="Photo to 2D" onClick={() => photoInputRef.current?.click()}>
            <FileImage size={20} />
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
          <svg
            ref={markupLayerRef}
            className={`markup-layer ${isMarkupTool(activeTool) ? 'is-active' : ''}`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onPointerDown={beginMarkup}
            onPointerMove={updateMarkup}
            onPointerUp={finishMarkup}
            onPointerCancel={() => setDraftMarkup(null)}
            onPointerLeave={finishMarkup}
          >
            <defs>
              <marker id="markup-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" className="markup-arrow-head" />
              </marker>
            </defs>
            {[...markups, ...(draftMarkup ? [draftMarkup] : [])].map((item) => (
              <MarkupShape key={item.id} item={item} />
            ))}
          </svg>
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
            <h2>Markup Drawing</h2>
            <div className="tool-grid">
              {markupTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    className={activeTool === tool.id ? 'selected' : ''}
                    onClick={() => setActiveTool((current) => (current === tool.id ? 'orbit' : tool.id))}
                  >
                    <Icon size={15} />
                    {tool.label}
                  </button>
                );
              })}
            </div>
            <div className="action-row">
              <button onClick={() => {
                setMarkups([]);
                setDraftMarkup(null);
              }}>
                <Eraser size={14} />
                Clear
              </button>
              <button
                disabled={markups.length === 0}
                onClick={() => downloadTextFile('stp-markup.svg', renderMarkupSvg(markups))}
              >
                <Download size={14} />
                SVG
              </button>
            </div>
            <p className="hint">{markups.length} markup item{markups.length === 1 ? '' : 's'}</p>
          </section>

          <section className="panel">
            <h2>Photo to 2D</h2>
            <button className="wide-action" onClick={() => photoInputRef.current?.click()}>
              <Image size={15} />
              Upload photo
            </button>
            <label className="range-row photo-range">
              <span>Edge threshold</span>
              <input
                type="range"
                min="18"
                max="140"
                value={photoThreshold}
                onChange={(event) => setPhotoThreshold(Number(event.target.value))}
              />
            </label>
            <p className="hint">{photoFile?.name ?? photoStatus}</p>
            {photoPreview && (
              <div className="photo-preview">
                <img src={photoPreview} alt="2D outline preview" />
              </div>
            )}
            <button
              className="wide-action"
              disabled={!photoSvg}
              onClick={() => downloadTextFile('photo-outline.svg', photoSvg)}
            >
              <Download size={15} />
              Download SVG
            </button>
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
        <span><Eye size={14} /> {toolText[activeTool]}</span>
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
      <input
        ref={photoInputRef}
        className="hidden-input"
        type="file"
        accept="image/*"
        onChange={(event) => processPhotoTo2d(event.target.files?.[0])}
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
