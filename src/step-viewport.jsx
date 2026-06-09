import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
    if (child.userData?.texture) child.userData.texture.dispose();
  });
}

function buildMesh(resultMesh, displayMode) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(resultMesh.attributes.position.array, 3));
  if (resultMesh.attributes.normal) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(resultMesh.attributes.normal.array, 3));
  }
  geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(resultMesh.index.array), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const color = resultMesh.color
    ? new THREE.Color(resultMesh.color[0], resultMesh.color[1], resultMesh.color[2])
    : new THREE.Color(0x6d8797);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.18,
    side: THREE.DoubleSide,
    wireframe: displayMode === 'wireframe',
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = resultMesh.name || 'STEP mesh';
  mesh.userData.pickable = true;

  const edgeLines = [];
  if (displayMode === 'edges' && resultMesh.brep_faces) {
    for (const face of resultMesh.brep_faces) {
      if (!face.first && face.first !== 0) continue;
      const positions = [];
      for (let i = face.first; i < face.last; i += 1) {
        const edge = resultMesh.edges?.[i];
        if (edge?.array) positions.push(...edge.array);
      }
      if (positions.length > 0) {
        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        edgeLines.push(new THREE.LineSegments(
          edgeGeometry,
          new THREE.LineBasicMaterial({ color: 0x23313a, transparent: true, opacity: 0.62 }),
        ));
      }
    }
  }

  return { mesh, edgeLines };
}

function getModelBox(object) {
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? null : box;
}

function fitCamera(camera, controls, object, viewName = 'iso') {
  const box = getModelBox(object);
  if (!box) return;

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = 1.35 * Math.max(fitHeightDistance, fitWidthDistance);
  const directions = {
    iso: new THREE.Vector3(1, -1.4, 0.9),
    front: new THREE.Vector3(0, -1, 0),
    right: new THREE.Vector3(1, 0, 0),
    top: new THREE.Vector3(0, 0, 1),
  };
  const direction = (directions[viewName] || directions.iso).normalize();

  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = distance * 1000;
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function makeTextSprite(text) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  canvas.width = 256 * ratio;
  canvas.height = 72 * ratio;
  context.scale(ratio, ratio);
  context.fillStyle = 'rgba(18, 31, 38, 0.92)';
  context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(8, 8, 240, 48, 8);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = '700 18px Segoe UI, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(38, 10, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function formatDistance(value) {
  return `${value.toFixed(2)} mm`;
}

function makePointMarker(point) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x0fb7a7, depthTest: false }),
  );
  marker.position.copy(point);
  return marker;
}

function makeMeasurement(id, start, end) {
  const group = new THREE.Group();
  group.name = `Measurement ${id}`;
  group.userData.measurementId = id;
  const distance = start.distanceTo(end);

  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xffb020, depthTest: false, depthWrite: false }),
  );
  group.add(line);
  group.add(makePointMarker(start));
  group.add(makePointMarker(end));

  const label = makeTextSprite(`M${id} ${formatDistance(distance)}`);
  label.position.copy(start).add(end).multiplyScalar(0.5);
  label.position.z += Math.max(distance * 0.035, 4);
  group.add(label);

  return { group, data: { id, distance, start: start.toArray(), end: end.toArray() } };
}

const StepViewport = forwardRef(function StepViewport({
  model,
  displayMode,
  activeTool,
  showGrid,
  darkCanvas,
  onStatus,
  onError,
  onStats,
  onDimensions,
  onMeasurements,
}, ref) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const modelGroupRef = useRef(new THREE.Group());
  const measurementGroupRef = useRef(new THREE.Group());
  const gridRef = useRef(null);
  const parsedResultRef = useRef(null);
  const mountedRef = useRef(true);
  const displayModeRef = useRef(displayMode);
  const activeToolRef = useRef(activeTool);
  const pendingPointRef = useRef(null);
  const measurementsRef = useRef([]);
  const nextMeasurementIdRef = useRef(1);

  useEffect(() => {
    displayModeRef.current = displayMode;
  }, [displayMode]);

  useEffect(() => {
    activeToolRef.current = activeTool;
    if (activeTool !== 'measure') pendingPointRef.current = null;
  }, [activeTool]);

  const publishMeasurements = useCallback(() => {
    onMeasurements([...measurementsRef.current]);
  }, [onMeasurements]);

  const clearMeasurements = useCallback(() => {
    disposeObject(measurementGroupRef.current);
    measurementGroupRef.current.clear();
    measurementsRef.current = [];
    pendingPointRef.current = null;
    publishMeasurements();
  }, [publishMeasurements]);

  const rebuildScene = useCallback((result, mode) => {
    const group = modelGroupRef.current;
    disposeObject(group);
    group.clear();

    let triangles = 0;
    let edges = 0;
    for (const resultMesh of result.meshes) {
      const { mesh, edgeLines } = buildMesh(resultMesh, mode);
      triangles += Math.floor((resultMesh.index?.array?.length ?? 0) / 3);
      group.add(mesh);
      for (const line of edgeLines) {
        edges += line.geometry.attributes.position.count / 2;
        group.add(line);
      }
    }

    const box = getModelBox(group);
    if (box) {
      const size = box.getSize(new THREE.Vector3());
      onDimensions({ x: size.x, y: size.y, z: size.z });
    }
    onStats({ meshes: result.meshes.length, triangles, edges: Math.round(edges) });
    fitCamera(cameraRef.current, controlsRef.current, group);
  }, [onDimensions, onStats]);

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);
    camera.position.set(8, -9, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb4c2c9, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(8, -9, 10);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb6ff, 0.55);
    fill.position.set(-8, 4, 6);
    scene.add(fill);

    const grid = new THREE.GridHelper(50, 50, 0xa4b3bc, 0xd3dbe0);
    grid.rotation.x = Math.PI / 2;
    gridRef.current = grid;
    scene.add(grid);

    scene.add(modelGroupRef.current);
    scene.add(measurementGroupRef.current);

    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;
    rendererRef.current = renderer;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event) => {
      if (activeToolRef.current !== 'measure') return;
      if (event.button !== 0) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const pickables = [];
      modelGroupRef.current.traverse((child) => {
        if (child.userData.pickable) pickables.push(child);
      });
      const hit = raycaster.intersectObjects(pickables, false)[0];
      if (!hit) return;

      event.preventDefault();
      controls.enabled = false;
      const point = hit.point.clone();
      if (!pendingPointRef.current) {
        pendingPointRef.current = point;
        const marker = makePointMarker(point);
        marker.name = 'Pending measure point';
        marker.userData.pendingMarker = true;
        measurementGroupRef.current.add(marker);
        return;
      }

      const pendingMarker = measurementGroupRef.current.children.find((child) => child.userData.pendingMarker);
      if (pendingMarker) {
        measurementGroupRef.current.remove(pendingMarker);
        disposeObject(pendingMarker);
      }

      const id = nextMeasurementIdRef.current;
      nextMeasurementIdRef.current += 1;
      const measurement = makeMeasurement(id, pendingPointRef.current, point);
      measurementGroupRef.current.add(measurement.group);
      measurementsRef.current.push(measurement.data);
      pendingPointRef.current = null;
      publishMeasurements();
    };

    const onPointerUp = () => {
      controls.enabled = true;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.setAnimationLoop(null);
      disposeObject(modelGroupRef.current);
      disposeObject(measurementGroupRef.current);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [publishMeasurements]);

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(darkCanvas ? 0x111820 : 0xf6f8fa);
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
      gridRef.current.material.opacity = darkCanvas ? 0.25 : 0.55;
      gridRef.current.material.transparent = true;
    }
  }, [darkCanvas, showGrid]);

  useEffect(() => {
    if (!model) return;
    let cancelled = false;

    async function parseStep() {
      onStatus('parsing');
      try {
        clearMeasurements();
        const { default: occtimportjs } = await import('occt-import-js');
        const occt = await occtimportjs({
          locateFile: (fileName) => `/${fileName}`,
        });
        const result = occt.ReadStepFile(new Uint8Array(model.buffer), null);
        if (cancelled || !mountedRef.current) return;

        if (!result?.meshes?.length) {
          throw new Error('STEP file did not produce displayable mesh geometry.');
        }

        parsedResultRef.current = result;
        rebuildScene(result, displayModeRef.current);
        onStatus('loaded');
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : String(err));
      }
    }

    parseStep();
    return () => {
      cancelled = true;
    };
  }, [model, rebuildScene, clearMeasurements, onError, onStatus]);

  useEffect(() => {
    if (parsedResultRef.current) {
      rebuildScene(parsedResultRef.current, displayMode);
    }
  }, [displayMode, rebuildScene]);

  useImperativeHandle(ref, () => ({
    fit() {
      fitCamera(cameraRef.current, controlsRef.current, modelGroupRef.current);
    },
    setView(viewName) {
      fitCamera(cameraRef.current, controlsRef.current, modelGroupRef.current, viewName);
    },
    clearMeasurements,
    focusMeasurement(id) {
      const group = measurementGroupRef.current.children.find((child) => child.userData.measurementId === id);
      if (group) fitCamera(cameraRef.current, controlsRef.current, group);
    },
    capture() {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const link = document.createElement('a');
      link.download = 'step-viewer-screenshot.png';
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    },
    exportGlb() {
      const group = new THREE.Group();
      group.add(modelGroupRef.current.clone());
      group.add(measurementGroupRef.current.clone());
      if (!group.children.length) return;
      const exporter = new GLTFExporter();
      exporter.parse(
        group,
        (gltf) => {
          const blob = new Blob([gltf], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'step-model.glb';
          link.click();
          URL.revokeObjectURL(url);
        },
        (error) => onError(error instanceof Error ? error.message : String(error)),
        { binary: true },
      );
    },
  }));

  return <div ref={containerRef} className={`viewport ${activeTool === 'measure' ? 'is-measuring' : ''}`} />;
});

export default StepViewport;
