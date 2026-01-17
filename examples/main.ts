if (import.meta.hot) {
  import.meta.hot.accept()
}

import {
  Color,
  Scene,
  ViewPoint,
  WebGPURenderer,
  GLTFLoader,
  GridHelper,
  Light,
  Text,
  TrueTypeFont,
  TextMaterial,
} from "../src"

document.addEventListener("DOMContentLoaded", async () => {
  const renderer = new WebGPURenderer()
  await renderer.init()

  if (!renderer.canvas) {
    console.error("Не удалось инициализировать WebGPU")
    return
  }

  renderer.setPixelRatio(window.devicePixelRatio)
  // Устанавливаем начальный размер
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.canvas)

  const scene = new Scene()
  scene.background = new Color(0.1, 0.1, 0.1)

  const viewPoint = new ViewPoint({
    element: renderer.canvas,
    fov: (2 * Math.PI) / 5,
    position: { x: 1000, y: -1000, z: 800 },
    near: 0.1,
    far: 10000,
  })

  const grid = new GridHelper(1000, 20)
  scene.add(grid)

  // --- Добавляем источник света ---
  const light = new Light(new Color(1, 1, 1), 1)
  light.position.set(1113, 1113, 1113)
  light.updateMatrix()
  scene.add(light)
  // --- Конец добавления источника света ---

  // --- Обработчик изменения размера окна ---
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
    viewPoint.setAspectRatio(window.innerWidth / window.innerHeight)
  })
  // --- Конец обработчика ---

  // --- Загрузка GLTF модели ---
  const loader = new GLTFLoader()

  // Загружаем модель с несколькими деталями и цветами
  const gltf = await loader.load("./models/engine/2CylinderEngine.gltf")

  gltf.scene.position.set(0, 0, 180)
  gltf.scene.rotation.z = Math.PI
  gltf.scene.updateMatrix()
  scene.add(gltf.scene)
  // --- Конец загрузки ---

  // --- Добавляем 3D Текст ---
  try {
    const font = await TrueTypeFont.fromUrl("/JetBrainsMono-Bold.ttf")
    const text = new Text("WebGPU Engine", font, 150, new TextMaterial({ color: new Color(1.0, 0.0, 0.0) }))

    // В Z-up системе (Blender style):
    // Ось Z смотрит вверх. Ось Y смотрит "от нас" (или "к нам", зависит от реализации).
    // Текст изначально создается в плоскости XY.
    // Чтобы он стоял вертикально лицом к камере (которая обычно где-то на Y < 0), нужно повернуть его вокруг X.

    text.rotation.x = Math.PI / 2 // Поднимаем с пола (XY) в вертикаль (XZ)

    // Центрируем
    text.position.set(-600, 0, 300)
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
  // --- Конец текста ---

  function animate() {
    requestAnimationFrame(animate)
    // Матрица объекта обновляется внутри рендерера
    renderer.render(scene, viewPoint)
  }

  animate()
})
