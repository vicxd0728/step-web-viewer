# STEP Viewer Integration

This viewer is designed as a local web service.

## Start Locally

Double-click:

```text
start-step-viewer.bat
```

Or run:

```powershell
cd C:\Users\vicxd\Documents\Codex\2026-06-05\3d-stp
npm.cmd run build
npm.cmd run start
```

The viewer URL is fixed:

```text
http://127.0.0.1:5181/
```

## Cloudflare Pages

The current public deployment is:

```text
https://step-web-viewer.pages.dev/
```

Manual deploy:

```powershell
npm.cmd run build
npx.cmd wrangler pages deploy dist --project-name step-web-viewer --branch main --commit-dirty=true
```

Cloudflare Pages build settings for GitHub integration:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 22
```

## Embed In Another Local Page

Use an iframe:

```html
<iframe
  src="https://step-web-viewer.pages.dev/"
  style="width: 100%; height: 720px; border: 0;"
  title="STEP 3D Viewer"
></iframe>
```

Recommended container CSS:

```css
.viewer-frame {
  width: 100%;
  height: min(78vh, 860px);
  min-height: 560px;
  border: 1px solid #d5dde3;
  border-radius: 8px;
  overflow: hidden;
  background: #f6f8fa;
}

.viewer-frame iframe {
  width: 100%;
  height: 100%;
  border: 0;
}
```

```html
<div class="viewer-frame">
  <iframe src="http://127.0.0.1:5181/" title="STEP 3D Viewer"></iframe>
</div>
```

## React Example

```jsx
export function StepViewerPanel() {
  return (
    <section className="viewer-frame">
      <iframe src="https://step-web-viewer.pages.dev/" title="STEP 3D Viewer" />
    </section>
  );
}
```

## Design Notes

- Keep port `5181` fixed.
- Use `npm.cmd run start` for normal local use.
- Use `npm.cmd run start:dev` only while editing the viewer.
- If this is embedded in a dashboard, show a fallback message when `http://127.0.0.1:5181/` is not reachable.
- For a deployed public site, do not depend on a local terminal. Build this project and host the `dist` folder, or merge the React component into the main app.
