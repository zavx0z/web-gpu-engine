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
  SphereGeometry,
  TorusGeometry,
  LineSegments,
  LineGlowMaterial,
  BufferGeometry,
  BufferAttribute,
} from "../src"
import { Vector3 } from "../src/math/Vector3"

document.addEventListener("DOMContentLoaded", async () => {
  const renderer = new Renderer()

  const canvas: HTMLCanvasElement = document.body.querySelector("#metafor")!
  await renderer.init(canvas)

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
    near: 0.1,
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

  let mixer: AnimationMixer | null = null
  if (gltf.animations.length > 0) {
    mixer = new AnimationMixer(gltf.scene)
    // The loader wraps content in a Z-up object (children[0]).
    // The actual GLTF root nodes (the bots) are children of this wrapper.
    const modelRoot = gltf.scene.children[0]

    gltf.animations.forEach((clip, index) => {
      // Bind Animation 0 -> Object 0, Animation 1 -> Object 1, etc.
      const localRoot = modelRoot && modelRoot.children[index] ? modelRoot.children[index] : gltf.scene
      const action = mixer!.clipAction(clip, localRoot)
      action.play()
    })
  }

  try {
    const font = await TrueTypeFont.fromUrl("./JetBrainsMono-Bold.ttf")
    const text = new Text("WebGPU Engine", font, 0.2, new TextMaterial({ color: new Color(1.0, 1.0, 1.0) }))
    text.position.set(-0.8, 0, 0.1)
    text.updateMatrix()
    scene.add(text)
  } catch (e) {
    console.error("Критическая ошибка при создании текста:", e)
  }

  // Функция для создания геометрии линий из mesh-геометрии
  function createWireframeGeometry(geometry: BufferGeometry): BufferGeometry {
    const indices = geometry.index!.array
    const positions = geometry.attributes.position.array

    const lines = []
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3
      const b = indices[i + 1] * 3
      const c = indices[i + 2] * 3

      // Линия AB
      lines.push(positions[a], positions[a + 1], positions[a + 2])
      lines.push(positions[b], positions[b + 1], positions[b + 2])

      // Линия BC
      lines.push(positions[b], positions[b + 1], positions[b + 2])
      lines.push(positions[c], positions[c + 1], positions[c + 2])

      // Линия CA
      lines.push(positions[c], positions[c + 1], positions[c + 2])
      lines.push(positions[a], positions[a + 1], positions[a + 2])
    }

    const wireframeGeometry = new BufferGeometry()
    wireframeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(lines), 3))
    return wireframeGeometry
  }

  // Создаем геометрию сферы один раз для переиспользования
  const sphereGeometry = new SphereGeometry({ radius: 0.04 })
  const sphereWireframe = createWireframeGeometry(sphereGeometry)

  // Первая сфера (красная) слева от тора
  const sphere1 = new LineSegments(
    sphereWireframe,
    new LineGlowMaterial({
      color: new Color("rgba(252, 70, 70, 0.52)"),
      glowIntensity: 1.4,
      glowColor: new Color("rgba(255, 255, 255, 1)"),
    }),
  )
  sphere1.position.set(-0.2, 0, 1)
  sphere1.updateMatrix()
  scene.add(sphere1)

  // Вторая сфера (зеленая) справа от тора
  const sphere2 = new LineSegments(
    sphereWireframe,
    new LineGlowMaterial({
      color: new Color("rgba(70, 252, 70, 0.52)"),
      glowIntensity: 1.4,
      glowColor: new Color("rgba(255, 255, 255, 1)"),
    }),
  )
  sphere2.position.set(0.2, 0, 1)
  sphere2.updateMatrix()
  scene.add(sphere2)

  // Тор как wireframe со светящимся материалом
  const torusGeometry = new TorusGeometry({ radius: 0.2, tube: 0.14 })
  const torusWireframe = createWireframeGeometry(torusGeometry)

  const torus = new LineSegments(
    torusWireframe,
    new LineGlowMaterial({
      color: new Color("rgba(104, 109, 251, 0.54)"),
      glowIntensity: 1.4,
      glowColor: new Color("rgba(255, 255, 255, 0.1)"),
    }),
  )
  torus.position.set(0, 0, 1)
  torus.updateMatrix()
  scene.add(torus)

  // Переменные для wiggli эффекта (только дрожание)
  let time = 0
  const sphere1OriginalPos = new Vector3(-0.2, 0, 1)
  const sphere2OriginalPos = new Vector3(0.2, 0, 1)
  const torusOriginalPos = new Vector3(0, 0, 1)

  // Параметры для wiggli эффекта - только небольшие колебания
  const sphere1WiggliParams = {
    amplitude: 0.015, // Маленькая амплитуда для легкого дрожания
    speedX: 3.5, // Разные скорости для естественного вида
    speedY: 4.2,
    speedZ: 2.8,
  }

  const sphere2WiggliParams = {
    amplitude: 0.018, // Чуть больше амплитуда для второй сферы
    speedX: 4.1,
    speedY: 3.7,
    speedZ: 2.4,
  }

  const torusWiggliParams = {
    amplitude: 0.02, // Чуть больше амплитуда для тора
    speedX: 2.8,
    speedY: 3.3,
    speedZ: 2.1,
  }

  // Случайные фазы для более естественного дрожания
  let sphere1Phase = Math.random() * Math.PI * 2
  let sphere2Phase = Math.random() * Math.PI * 2
  let torusPhase = Math.random() * Math.PI * 2

  let lastTime = performance.now()

  function animate() {
    requestAnimationFrame(animate)

    const currentTime = performance.now()
    const delta = (currentTime - lastTime) / 1000
    lastTime = currentTime
    time += delta

    if (mixer) mixer.update(delta)

    // Wiggli эффект для первой сферы - только дрожание позиции
    const sphere1OffsetX = Math.sin(time * sphere1WiggliParams.speedX + sphere1Phase) * sphere1WiggliParams.amplitude
    const sphere1OffsetY =
      Math.cos(time * sphere1WiggliParams.speedY + sphere1Phase * 1.3) * sphere1WiggliParams.amplitude
    const sphere1OffsetZ =
      Math.sin(time * sphere1WiggliParams.speedZ + sphere1Phase * 0.7) * sphere1WiggliParams.amplitude * 0.7

    sphere1.position.set(
      sphere1OriginalPos.x + sphere1OffsetX,
      sphere1OriginalPos.y + sphere1OffsetY,
      sphere1OriginalPos.z + sphere1OffsetZ,
    )

    // Wiggli эффект для второй сферы - только дрожание позиции
    const sphere2OffsetX = Math.sin(time * sphere2WiggliParams.speedX + sphere2Phase) * sphere2WiggliParams.amplitude
    const sphere2OffsetY =
      Math.cos(time * sphere2WiggliParams.speedY + sphere2Phase * 1.5) * sphere2WiggliParams.amplitude
    const sphere2OffsetZ =
      Math.sin(time * sphere2WiggliParams.speedZ + sphere2Phase * 0.9) * sphere2WiggliParams.amplitude * 0.6

    sphere2.position.set(
      sphere2OriginalPos.x + sphere2OffsetX,
      sphere2OriginalPos.y + sphere2OffsetY,
      sphere2OriginalPos.z + sphere2OffsetZ,
    )

    // Wiggli эффект для тора - только дрожание позиции
    const torusOffsetX = Math.sin(time * torusWiggliParams.speedX + torusPhase) * torusWiggliParams.amplitude
    const torusOffsetY = Math.cos(time * torusWiggliParams.speedY + torusPhase * 1.1) * torusWiggliParams.amplitude
    const torusOffsetZ =
      Math.sin(time * torusWiggliParams.speedZ + torusPhase * 0.6) * torusWiggliParams.amplitude * 0.5

    torus.position.set(
      torusOriginalPos.x + torusOffsetX,
      torusOriginalPos.y + torusOffsetY,
      torusOriginalPos.z + torusOffsetZ,
    )

    // Обновление матриц
    sphere1.updateMatrix()
    sphere2.updateMatrix()
    torus.updateMatrix()
    scene.updateWorldMatrix()

    gltf.scene.traverse((obj: any) => {
      if (obj.isSkinnedMesh) obj.skeleton.update()
    })

    renderer.render(scene, viewPoint)
  }

  animate()
})
