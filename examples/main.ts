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
  AnimationMixer,
  Object3D,
  SkinnedMesh
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
    position: { x: 2, y: -3, z: 1.5 },
    target: { x: 0, y: 0, z: 0.5 },
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
    const clip = gltf.animations[0]; // Проигрываем первую анимацию
    if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
    }
  }

  try {
    const font = await TrueTypeFont.fromUrl("./JetBrainsMono-Bold.ttf")
    const text = new Text("WebGPU Engine", font, 0.2, new TextMaterial({ color: new Color(1.0, 1.0, 1.0) }))
    text.rotation.x = Math.PI / 2
    text.position.set(-0.8, 0, 1.5)
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

    if (mixer) {
      mixer.update(delta);
    }

    scene.updateWorldMatrix();
    renderer.render(scene, viewPoint)
  }

  animate()
})

