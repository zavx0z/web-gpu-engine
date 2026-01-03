if (import.meta.hot) {
  import.meta.hot.accept();
}

import { WebGPURenderer, Scene, PerspectiveCamera, Mesh, TorusGeometry, BasicMaterial, vec3 } from './engine.js';

async function main() {
  const renderer = new WebGPURenderer();
  await renderer.init();

  const scene = new Scene();

  const camera = new PerspectiveCamera((2 * Math.PI) / 5, window.innerWidth / window.innerHeight, 0.1, 100.0);
  camera.position[2] = 2;
  camera.lookAt(vec3.fromValues(0, 0, 0));

  const geometry = new TorusGeometry(0.4, 0.2, 32, 16);
  const material = new BasicMaterial();
  const torus = new Mesh(geometry, material);

  scene.add(torus);

  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
}

main();