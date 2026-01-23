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
  WireframeInstancedMesh,
  MeshLambertMaterial,
} from "../src"
import { Matrix4 } from "../src/math/Matrix4"
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
  const sphereGeometry = new SphereGeometry({ radius: 0.14 })
  const sphereWireframe = createWireframeGeometry(sphereGeometry)

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

  // Два инстанса сфер внутри тора
  const instanceCount = 2
  const spheresInsideTorus = new WireframeInstancedMesh(
    sphereWireframe,
    new LineGlowMaterial({
      color: new Color("rgba(252, 70, 70, 0.69)"),
      glowIntensity: 1.4,
      glowColor: new Color("rgba(255, 255, 255, 1)"),
    }),
    instanceCount,
  )

  // Располагаем инстансы внутри тора (по бокам)
  const tempMatrix = new Matrix4()
  const tempVector = new Vector3()

  // Первый инстанс слева (относительно тора)
  tempMatrix.identity()
  tempMatrix.makeTranslation(-0.1, 0, 0) // Z=0, так как теперь относительно тора
  tempVector.set(0.5, 0.5, 0.5)
  tempMatrix.scale(tempVector)
  spheresInsideTorus.setMatrixAt(0, tempMatrix)

  // Второй инстанс справа (относительно тора)
  tempMatrix.identity()
  tempMatrix.makeTranslation(0.1, 0, 0) // Z=0, так как теперь относительно тора
  tempVector.set(0.5, 0.5, 0.5)
  tempMatrix.scale(tempVector)
  spheresInsideTorus.setMatrixAt(1, tempMatrix)

  spheresInsideTorus.position.set(0, 0, 0)
  spheresInsideTorus.updateMatrix()
  torus.add(spheresInsideTorus)



  // Переменные для wiggli эффекта (только дрожание)
  let time = 0
  const torusOriginalPos = new Vector3(0, 0, 1)
  const sphereRelativePositions = [
    new Vector3(-0.1, 0, 0), // Относительно тора
    new Vector3(0.1, 0, 0)
  ]

  // Параметры для wiggli эффекта - только небольшие колебания
  const torusWiggliParams = {
    amplitude: 0.02, // Чуть больше амплитуда для тора
    speedX: 2.8,
    speedY: 3.3,
    speedZ: 2.1,
  }

  // Параметры для wiggli эффекта сфер
  const spheresWiggliParams = [
    { // Первая сфера
      amplitude: 0.015,
      speedX: 3.5,
      speedY: 4.2,
      speedZ: 2.8,
    },
    { // Вторая сфера
      amplitude: 0.018,
      speedX: 4.1,
      speedY: 3.7,
      speedZ: 2.4,
    }
  ]

  // Случайные фазы для более естественного дрожания
  let torusPhase = Math.random() * Math.PI * 2
  let spherePhases = [
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  ]

  let lastTime = performance.now()

  function animate() {
    requestAnimationFrame(animate)

    const currentTime = performance.now()
    const delta = (currentTime - lastTime) / 1000
    lastTime = currentTime
    time += delta

    if (mixer) mixer.update(delta)

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

    // Wiggli эффект для инстансированных сфер (относительно тора)
    const tempMatrix = new Matrix4()
    const tempVector = new Vector3()
    
    for (let i = 0; i < 2; i++) {
      const sphereOffsetX = Math.sin(time * spheresWiggliParams[i].speedX + spherePhases[i]) * spheresWiggliParams[i].amplitude
      const sphereOffsetY = Math.cos(time * spheresWiggliParams[i].speedY + spherePhases[i] * 1.3) * spheresWiggliParams[i].amplitude
      const sphereOffsetZ = Math.sin(time * spheresWiggliParams[i].speedZ + spherePhases[i] * 0.7) * spheresWiggliParams[i].amplitude * 0.7
      
      const newPos = new Vector3(
        sphereRelativePositions[i].x + sphereOffsetX,
        sphereRelativePositions[i].y + sphereOffsetY,
        sphereRelativePositions[i].z + sphereOffsetZ
      )
      
      tempMatrix.identity()
      tempMatrix.makeTranslation(newPos.x, newPos.y, newPos.z)
      tempVector.set(0.5, 0.5, 0.5)
      tempMatrix.scale(tempVector)
      
      spheresInsideTorus.setMatrixAt(i, tempMatrix)
    }

    // Важно: очищаем кэш геометрии в рендерере, чтобы он пересоздал буферы с новыми матрицами
    // Это заставит рендерер создать новые буферы GPU с обновленными данными
    renderer.geometryCache.delete(spheresInsideTorus.geometry)

    // Обновляем геометрию с новыми матрицами инстансов
    spheresInsideTorus.geometry.setAttribute('instanceMatrix', 
      new BufferAttribute(spheresInsideTorus.instanceMatrix, 16)
    )

    // Обновление матриц
    torus.updateMatrix()
    spheresInsideTorus.updateMatrix()
    scene.updateWorldMatrix()

    gltf.scene.traverse((obj: any) => {
      if (obj.isSkinnedMesh) obj.skeleton.update()
    })

    renderer.render(scene, viewPoint)
  }

  animate()
})
