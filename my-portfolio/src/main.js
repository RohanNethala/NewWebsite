// src/main.js  — WebGPU (no timerLocal) + WebGL fallback + on-screen status

// ---- tiny on-screen status so blanks aren't silent ----
const status = document.createElement('div');
status.style.cssText =
  'position:fixed;left:12px;bottom:12px;padding:6px 10px;font:12px/1.2 system-ui;background:rgba(0,0,0,.5);color:#fff;border-radius:6px;z-index:9999';
status.textContent = 'Starting…';
document.body.append(status);
const setStatus = (msg) => (status.textContent = msg);

// ---- full-screen canvas behind your site ----
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;z-index:-1';
document.body.prepend(canvas);

// Respect reduced motion: hide canvas if user prefers it
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  canvas.style.display = 'none';
  setStatus('Reduced motion: background disabled');
}

// Entry
init().catch((e) => {
  console.error(e);
  setStatus('Error: ' + e.message);
});

async function init() {
  // If user prefers reduced motion, don’t init
  if (canvas.style.display === 'none') return;

  // Try WebGPU first
  if ('gpu' in navigator) {
    try {
      setStatus('WebGPU: initializing…');

      // Dynamic imports (avoid mixing classic THREE with webgpu build)
      const threeGpu = await import('three/webgpu');
      const tsl = await import('three/tsl'); // NOTE: no timerLocal usage

      const {
        Scene,
        PerspectiveCamera,
        Color,
        Points,
        BufferGeometry,
        Float32BufferAttribute,
        WebGPURenderer,
      } = threeGpu;
      const { color } = tsl; // constant color only (no animated TSL)

      const scene = new Scene();
      scene.background = new Color(0x000007);

      const camera = new PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
      camera.position.z = 140;

      const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
      await renderer.init(); // critical for WebGPU

      // ---- galaxy-like point cloud ----
      const count = 20000;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = Math.random() ** 0.5 * 120;
        const a = Math.random() * Math.PI * 2;
        positions[i * 3 + 0] = Math.cos(a) * r;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
        positions[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(positions, 3));

      const pts = new Points(geo);
      pts.material.size = 1.5;
      pts.material.sizeAttenuation = true;
      // constant TSL color (works on older three that lacks timerLocal)
      pts.material.colorNode = color(0x8fb3ff);
      scene.add(pts);

      function resize() {
        const w = innerWidth, h = innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
      addEventListener('resize', resize);
      resize();

      renderer.setAnimationLoop(() => {
        // keep a little motion by rotating the cloud
        pts.rotation.y += 0.0008;
        renderer.render(scene, camera);
      });

      setStatus('WebGPU running');
      setTimeout(() => status.remove(), 1500);
      return;
    } catch (err) {
      console.warn('WebGPU path failed, falling back to WebGL…', err);
      setStatus('WebGPU failed → WebGL fallback…');
    }
  } else {
    setStatus('No WebGPU → WebGL fallback…');
  }

  // ---- WebGL fallback (classic three) ----
  await startWebGLFallback();
  setStatus('WebGL running');
  setTimeout(() => status.remove(), 1500);
}

async function startWebGLFallback() {
  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000007);

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
  camera.position.z = 140;

  // Simple starfield
  const count = 15000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random() ** 0.5 * 120;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: true, color: 0x8fb3ff });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(() => {
    points.rotation.y += 0.0008;
    renderer.render(scene, camera);
  });
}
