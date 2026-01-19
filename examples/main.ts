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
} from "../src"

document.addEventListener("DOMContentLoaded", async () => {
  const renderer = new Renderer()
  await renderer.init()

  if (!renderer.canvas) {
    console.error("Не удалось инициализировать WebGPU")
    return
  }

  renderer.setPixelRatio(window.devicePixelRatio)
  // Устанавливаем начальный размер
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
    position: { x: 0.5, y: -2, z: 0.4 },
    near: .1,
    far: 100,
  })

  const grid = new GridHelper(2, 20)
  scene.add(grid)

  const light = new Light(new Color(1, 1, 1), 1)
  light.position.set(4, -4, 4)
  light.updateMatrix()
  scene.add(light)

  // --- Загрузка GLTF модели ---
  const loader = new GLTFLoader()
  const gltf = await loader.load("./models/engine.gltf")
  gltf.scene.position.set(0, 0, 0.2)
  gltf.scene.rotation.z = Math.PI
  gltf.scene.updateMatrix()
  scene.add(gltf.scene)

  try {
    const font = await TrueTypeFont.fromUrl("./JetBrainsMono-Bold.ttf")
    const text = new Text("WebGPU Engine", font, 0.2, new TextMaterial({ color: new Color(1.0, 0.0, 0.0) }))
    text.rotation.x = Math.PI / 2
    text.position.set(-0.8, 0, 0.4)
    text.updateMatrix()
    scene.add(text)
  } catch (e) {
    console.error("Критическая ошибка при создании текста:", e)
    // Визуальный маркер ошибки
    const errorBox = new GridHelper(200, 2, 0xff0000, 0xff0000)
    errorBox.position.set(0, 0, 300)
    errorBox.rotation.x = Math.PI / 2
    errorBox.updateMatrix()
    scene.add(errorBox)
  }

  function animate() {
    requestAnimationFrame(animate)
    // Матрица объекта обновляется внутри рендерера
    renderer.render(scene, viewPoint)
  }

  animate()
})
