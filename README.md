# STEP Web Viewer

Browser-based `.stp` / `.step` CAD viewer prototype.

## Run

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run preview -- --port 5181
```

Open:

```text
http://127.0.0.1:5181
```

## Features

- Upload `.stp` / `.step` files from the browser.
- Parse STEP with `occt-import-js` WebAssembly.
- Render geometry with Three.js orbit controls.
- Toggle shaded, edges, and wireframe display modes.
- Fit view, preset views, screenshot, grid, dark canvas, and GLB export controls.
- Show model bounding-box size for X, Y, and Z.
- Point-to-point measurement on model surfaces.
- Measurement list, focus, and clear controls.

## Measurement Workflow

1. Upload a `.stp` or `.step` file.
2. Click the ruler tool in the left toolbar.
3. Click one point on the model.
4. Click a second point on the model.
5. The viewer draws a measurement line and records the distance in the right panel.

Use the trash tool to clear all measurements.

## Website Deployment Notes

The production build is in `dist` after running:

```powershell
npm.cmd run build
```

Upload the full `dist` folder to a static website host. Keep `occt-import-js.wasm` at the website root because the viewer loads it from `/occt-import-js.wasm`.

For public product pages, the recommended long-term flow is to convert STEP files to `.glb` first, then load `.glb` on the website. Direct STEP parsing is useful for internal tools and upload workflows, but `.glb` is faster and lighter for visitors.
