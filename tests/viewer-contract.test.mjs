import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bytes = (relativePath) => readFile(path.join(root, relativePath));
const text = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("sample STEP asset has a complete ISO-10303-21 envelope", async () => {
  const source = await bytes("c9-a16-c_asm.stp");
  assert.ok(source.length > 5_000_000);
  assert.equal(source.subarray(0, 12).toString("ascii"), "ISO-10303-21");
  assert.match(source.subarray(-128).toString("ascii"), /END-ISO-10303-21;/);
});

test("OCCT WebAssembly asset is present and structurally valid", async () => {
  const wasm = await bytes("public/occt-import-js.wasm");
  assert.ok(wasm.length > 7_000_000);
  assert.deepEqual([...wasm.subarray(0, 8)], [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
});

test("viewer keeps STEP/3MF parsing, WebGL, and upload contracts", async () => {
  const [viewport, main] = await Promise.all([text("src/step-viewport.jsx"), text("src/main.jsx")]);
  assert.match(viewport, /import\('occt-import-js'\)/);
  assert.match(viewport, /import\('three\/examples\/jsm\/loaders\/3MFLoader\.js'\)/);
  assert.match(viewport, /locateFile:\s*\(fileName\) => `\/\$\{fileName\}`/);
  assert.match(viewport, /ReadStepFile\(new Uint8Array\(model\.buffer\), null\)/);
  assert.match(viewport, /new THREE\.WebGLRenderer\(\{ antialias: true, preserveDrawingBuffer: true \}\)/);
  assert.match(viewport, /STEP file did not produce displayable mesh geometry/);
  assert.match(viewport, /3MF file did not produce displayable mesh geometry/);
  assert.match(main, /accept="\.stp,\.step,\.3mf"/);
});

test("verification cannot deploy or replace the sample model", async () => {
  const pkg = JSON.parse(await text("package.json"));
  assert.equal(pkg.scripts.verify, "npm run test:contract && npm run build");
  assert.doesNotMatch(pkg.scripts.verify, /(?:deploy|wrangler|c9-a16-c_asm|Remove-Item|rimraf)/i);
});

test("first-party text remains strict UTF-8", async () => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const file of ["src/main.jsx", "src/step-viewport.jsx", "src/styles.css", "README.md", "public/manifest.webmanifest", "public/sw.js"]) {
    const content = decoder.decode(await bytes(file));
    assert.equal(content.includes("\uFFFD"), false, `${file} contains a replacement character`);
  }
});
