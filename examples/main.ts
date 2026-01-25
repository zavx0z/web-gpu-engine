console.log("📜 MAIN.TS: Module Evaluation Started");
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
  Raycaster,
  Object3D,
} from "../src"
import { Matrix4 } from "../src/math/Matrix4"
import { Vector3 } from "../src/math/Vector3"
import YogaService from "../src/layout/YogaService"
import { LayoutManager } from "../src/layout/LayoutManager"
import { UIDisplay } from "../src/ui/UIDisplay"

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Application Starting...");

  try {
    console.log("📦 Initializing Yoga Layout...");
    await YogaService.instance.initialize();
    console.log("✅ Yoga Layout Initialized");
  } catch (e) {
    console.error("⚠️ WARNING: Yoga failed to load. Layouts may not work.", e);
    // Do not return, let the renderer try to start
  }

  console.log("🔧 Initializing Renderer...");
  const renderer = new Renderer()
  const canvas: HTMLCanvasElement = document.body.querySelector("#metafor")!
  
  try {
    await renderer.init(canvas)
    console.log("✅ Renderer Initialized");
  } catch (err) {
    console.error("❌ FATAL: Renderer init failed", err);
    return;
  }

  if (!renderer.canvas) {
    console.error("❌ FATAL: No canvas after init")
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

  // --- Raycaster Setup ---
  const raycaster = new Raycaster()
  const mouse = { x: 0, y: 0 }
  window.addEventListener("mousemove", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
  })

  const light = new Light(new Color(1, 1, 1), 1)
  light.position.set(4, -4, 4)
  light.updateMatrix()
  scene.add(light)

  // --- Layout Example: Physical Display ---
  const layoutManager = new LayoutManager()

  // Создаем дисплей: 0.4м ширина, 0.3м высота (40х30 см)
  // Разрешение: 800x600 пикселей
  const display = new UIDisplay({
    width: 0.4,
    height: 0.3,
    pixelWidth: 800,
    pixelHeight: 600,
    background: new Color(0.05, 0.05, 0.05) // Темно-серый корпус
  })

  // Позиционируем дисплей в мире (метры)
  // Ставим слева от центра, на уровне глаз робота
  display.position.set(-0.6, 0, 1.2)
  // Поворачиваем вертикально (Plane изначально лежит в XY, нам нужно повернуть X на 90, чтобы он встал вертикально)
  // И затем повернуть к камере.
  // В Z-up:
  // PlaneGeometry (XY plane).
  // rotation.x = 90deg (PI/2) -> становится XZ плоскостью (лицом к -Y)
  display.rotation.x = Math.PI / 2
  // Довернем немного к зрителю
  display.rotation.z = Math.PI / 6

  display.updateMatrix()
  scene.add(display)

  const textMaterial = new TextMaterial({ color: new Color(0.4, 0.8, 1.0) }) // Голубой текст терминала
  const fontLoaded = await TrueTypeFont.fromUrl("./JetBrainsMono-Bold.ttf")

  // Хелпер для создания текстовых элементов с пиксельными размерами
  const createUIText = (str: string, fontSizePx: number, marginTopPx: number) => {
    const fontSizeWorld = display.getFontSize(fontSizePx)
    const t = new Text(str, fontLoaded, fontSizeWorld, textMaterial)
    // В Yoga задаем размеры в пикселях
    t.layout = {
        margin: marginTopPx,
        height: fontSizePx * 1.2, // Чуть больше высоты шрифта
        width: '100%' // На всю ширину контейнера (с учетом паддингов)
    }
    return t
  }

  display.addUI(createUIText("SYSTEM ONLINE", 48, 0))
  display.addUI(createUIText("----------------", 24, 10))
  display.addUI(createUIText("GPU: ACTIVE", 32, 20))
  display.addUI(createUIText("MEM: 12GB / 16GB", 32, 10))
  display.addUI(createUIText("TASKS: 4 RUNNING", 32, 10))

  // --- Загрузка GLTF модели ---
  console.log("📥 Loading GLTF Model...");
  const loader = new GLTFLoader()
  const gltf = await loader.load("./models/bots.glb")
  console.log("✅ GLTF Model Loaded");

  gltf.scene.position.set(0, 0, 0)
  gltf.scene.rotation.z = Math.PI
  gltf.scene.updateMatrix()
  scene.add(gltf.scene)

  let mixer: AnimationMixer | null = null
  if (gltf.animations.length > 0) {
    mixer = new AnimationMixer(gltf.scene)
    const modelRoot = gltf.scene.children[0]
    gltf.animations.forEach((clip, index) => {
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

  function createWireframeGeometry(geometry: BufferGeometry): BufferGeometry {
    const indices = geometry.index!.array
    const positions = geometry.attributes.position.array
    const lines = []
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3
      const b = indices[i + 1] * 3
      const c = indices[i + 2] * 3
      lines.push(positions[a], positions[a + 1], positions[a + 2])
      lines.push(positions[b], positions[b + 1], positions[b + 2])
      lines.push(positions[b], positions[b + 1], positions[b + 2])
      lines.push(positions[c], positions[c + 1], positions[c + 2])
      lines.push(positions[c], positions[c + 1], positions[c + 2])
      lines.push(positions[a], positions[a + 1], positions[a + 2])
    }
    const wireframeGeometry = new BufferGeometry()
    wireframeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(lines), 3))
    return wireframeGeometry
  }

  const sphereGeometry = new SphereGeometry({ radius: 0.14 })
  const sphereWireframe = createWireframeGeometry(sphereGeometry)
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

  const instanceCount = 2
  const spheresInsideTorus = new WireframeInstancedMesh(
    sphereWireframe,
    new LineGlowMaterial({
      color: new Color("rgba(252, 70, 70, 0.8)"),
      glowIntensity: 1,
      glowColor: new Color("rgba(252, 70, 70, 0.8)"),
    }),
    instanceCount,
  )
  spheresInsideTorus.setMaterialAt(
    1,
    new LineGlowMaterial({
      color: new Color("rgba(70, 252, 70, 0.8)"),
      glowIntensity: 1.5,
      glowColor: new Color("rgba(70, 252, 70, 0.8)"),
    }),
  )

  const tempMatrix = new Matrix4()
  const tempVector = new Vector3()

  tempMatrix.identity()
  tempMatrix.makeTranslation(-0.1, 0, 0)
  tempVector.set(0.5, 0.5, 0.5)
  tempMatrix.scale(tempVector)
  spheresInsideTorus.setMatrixAt(0, tempMatrix)

  tempMatrix.identity()
  tempMatrix.makeTranslation(0.1, 0, 0)
  tempVector.set(0.5, 0.5, 0.5)
  tempMatrix.scale(tempVector)
  spheresInsideTorus.setMatrixAt(1, tempMatrix)

  spheresInsideTorus.position.set(0, 0, 0)
  spheresInsideTorus.updateMatrix()
  torus.add(spheresInsideTorus)

  let time = 0
  const torusOriginalPos = new Vector3(0, 0, 1)
  const sphereRelativePositions = [
    new Vector3(-0.1, 0, 0),
    new Vector3(0.1, 0, 0),
  ]
  const torusWiggliParams = {
    amplitude: 0.02,
    speedX: 2.8,
    speedY: 3.3,
    speedZ: 2.1,
  }
  const spheresWiggliParams = [
    { amplitude: 0.015, speedX: 3.5, speedY: 4.2, speedZ: 2.8 },
    { amplitude: 0.018, speedX: 4.1, speedY: 3.7, speedZ: 2.4 },
  ]
  let torusPhase = Math.random() * Math.PI * 2
  let spherePhases = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2]

  console.log("🎬 Starting Animation Loop");
  let lastTime = performance.now()
  let frameCount = 0;

  function animate() {
    requestAnimationFrame(animate)
    frameCount++;
    if (frameCount % 100 === 0) console.log(`Stats: Frame ${frameCount}`);
    
    // Обновляем лейаут дисплея
    // Передаем корневой контейнер контента, размеры в ПИКСЕЛЯХ и масштаб (метры/пиксель)
    layoutManager.update(
        display.contentContainer,
        display.pixelWidth,
        display.pixelHeight,
        display.pixelScale
    )

    const currentTime = performance.now()
    const delta = (currentTime - lastTime) / 1000
    lastTime = currentTime
    time += delta

    raycaster.setFromCamera(mouse, viewPoint)
    spheresInsideTorus.setGlowColorAt(0, new Color("rgba(252, 70, 70, 0.8)"))
    spheresInsideTorus.setGlowIntensityAt(0, 1.0)
    spheresInsideTorus.setGlowColorAt(1, new Color("rgba(70, 252, 70, 0.8)"))
    spheresInsideTorus.setGlowIntensityAt(1, 1.5)

    const intersects = raycaster.intersectObject(spheresInsideTorus)
    if (intersects.length > 0) {
      const hit = intersects[0]
      if (hit.instanceId !== undefined) {
        spheresInsideTorus.setGlowColorAt(hit.instanceId, new Color(1, 1, 1, 1))
        spheresInsideTorus.setGlowIntensityAt(hit.instanceId, 3.0)
      }
    }

    if (mixer) mixer.update(delta)

    const torusOffsetX = Math.sin(time * torusWiggliParams.speedX + torusPhase) * torusWiggliParams.amplitude
    const torusOffsetY = Math.cos(time * torusWiggliParams.speedY + torusPhase * 1.1) * torusWiggliParams.amplitude
    const torusOffsetZ = Math.sin(time * torusWiggliParams.speedZ + torusPhase * 0.6) * torusWiggliParams.amplitude * 0.5
    torus.position.set(
      torusOriginalPos.x + torusOffsetX,
      torusOriginalPos.y + torusOffsetY,
      torusOriginalPos.z + torusOffsetZ,
    )

    for (let i = 0; i < 2; i++) {
      const sphereOffsetX = Math.sin(time * spheresWiggliParams[i].speedX + spherePhases[i]) * spheresWiggliParams[i].amplitude
      const sphereOffsetY = Math.cos(time * spheresWiggliParams[i].speedY + spherePhases[i] * 1.3) * spheresWiggliParams[i].amplitude
      const sphereOffsetZ = Math.sin(time * spheresWiggliParams[i].speedZ + spherePhases[i] * 0.7) * spheresWiggliParams[i].amplitude * 0.7
      const newPos = new Vector3(
        sphereRelativePositions[i].x + sphereOffsetX,
        sphereRelativePositions[i].y + sphereOffsetY,
        sphereRelativePositions[i].z + sphereOffsetZ,
      )
      tempMatrix.identity()
      tempMatrix.makeTranslation(newPos.x, newPos.y, newPos.z)
      tempVector.set(0.5, 0.5, 0.5)
      tempMatrix.scale(tempVector)
      spheresInsideTorus.setMatrixAt(i, tempMatrix)
    }

    spheresInsideTorus.update()
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
