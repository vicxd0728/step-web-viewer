import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const readerUrl = 'http://127.0.0.1:8788/parasolid';
const maxUploadSize = 25 * 1024 * 1024;

export async function readParasolid(buffer, signal) {
  if (!buffer.byteLength || buffer.byteLength > maxUploadSize) {
    throw new Error('Parasolid files must be non-empty and at most 25 MB.');
  }

  let response;
  try {
    response = await fetch(readerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: buffer,
      signal,
    });
  } catch {
    signal.throwIfAborted();
    throw new Error('Start start-parasolid-reader.bat and allow local network access, then retry the .x_t file.');
  }
  if (!response.ok) throw new Error(await response.text() || 'Parasolid import failed.');

  const { scene } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
  let hasMesh = false;
  scene.traverse((node) => {
    if (node.isMesh && node.geometry.getAttribute('position')?.count) hasMesh = true;
  });
  if (!hasMesh) throw new Error('The Parasolid reader returned no displayable geometry.');
  return scene;
}
