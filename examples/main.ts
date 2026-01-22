if (import.meta.hot) import.meta.hot.accept()

import {
  Color,
  Scene,
  ViewPoint,
  Renderer,
  GLTFLoader,
  GridHelper,
  Light,
  Text,
  TrueTypeFont,
  TextMaterial,
  AnimationMixer
} from "../src"

document.addEventListener("DOMContentLoaded", async () => {
  const renderer = new Renderer()
  await renderer.init()
  if (!renderer.canvas) {
    console.error("Не удалось инициализировать WebGPU")
    return
  }
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    viewPoint.setAspectRatio(window.innerWidth / window.innerHeight)
  })
  document.body.appendChild(renderer.canvas)

  const scene = new Scene()
  scene.background = new Color(0.1, 0.1, 0.1)

  const viewPoint = new ViewPoint({
    element: renderer.canvas,
    fov: (2 * Math.PI) / 5,
    position: { x: 2, y: -1.5, z: 1.5 },
    target: { x: 0, y: 0, z: 1 },
    near: .1,
    far: 100,
  })

  const grid = new GridHelper(10, 20)
  scene.add(grid)

  const light = new Light(new Color(1, 1, 1), 1)
  light.position.set(4, -4, 4)
  light.updateMatrix()
  scene.add(light)

  // --- Загрузка GLTF модели ---
  const loader = new GLTFLoader()
  const gltf = await loader.load("./models/bots.glb")
  gltf.scene.position.set(0, 0, 0)
  gltf.scene.rotation.z = Math.PI
  gltf.scene.updateMatrix()
  scene.add(gltf.scene)

  let mixer: AnimationMixer | null = null;
  if (gltf.animations.length > 0) {
    mixer = new AnimationMixer(gltf.scene);
    // The loader wraps content in a Z-up object (children[0]).
    // The actual GLTF root nodes (the bots) are children of this wrapper.
    const modelRoot = gltf.scene.children[0];
    
    gltf.animations.forEach((clip, index) => {
      // Bind Animation 0 -> Object 0, Animation 1 -> Object 1, etc.
      const localRoot = (modelRoot && modelRoot.children[index]) ? modelRoot.children[index] : gltf.scene;
      const action = mixer!.clipAction(clip, localRoot);
      action.play();
    });
  }

  try {
    const font = await TrueTypeFont.fromUrl("./JetBrainsMono-Bold.ttf")
    const text = new Text("WebGPU Engine", font, 0.2, new TextMaterial({ color: new Color(1.0, 1.0, 1.0) }))
    // text.rotation.x = Math.PI / 2
    text.position.set(-0.8, 0, 0)
    text.updateMatrix()
    scene.add(text)
  } catch (e) {
    console.error("Критическая ошибка при создании текста:", e)
  }

  let lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate)

    const time = performance.now();
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    if (mixer) mixer.update(delta);

    scene.updateWorldMatrix();

    gltf.scene.traverse((obj: any) => {
      if (obj.isSkinnedMesh) obj.skeleton.update();
    });

    renderer.render(scene, viewPoint)
  }

  animate()
})

