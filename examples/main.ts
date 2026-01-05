if (import.meta.hot) {
	import.meta.hot.accept()
}

import {
	Color,
	Scene,
	ViewPoint,
	WebGPURenderer,
	GLTFLoader,
} from "../src/WebGPUEngine"

// --- CSS для полноэкранного режима ---
const style = document.createElement("style")
style.textContent = `
  body {
    margin: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100vw;
    height: 100vh;
  }
`
document.head.appendChild(style)
// --- Конец CSS ---

document.addEventListener("DOMContentLoaded", async () => {
	const renderer = new WebGPURenderer()
	await renderer.init()

	if (!renderer.canvas) {
		console.error("Не удалось инициализировать WebGPU")
		return
	}

	// Устанавливаем начальный размер
	renderer.setSize(window.innerWidth, window.innerHeight)
	document.body.appendChild(renderer.canvas)

	const scene = new Scene()
	scene.background = new Color(0.1, 0.1, 0.1)

	const viewPoint = new ViewPoint({
		element: renderer.canvas,
		fov: (2 * Math.PI) / 5,
		position: { x: 0, y: 300, z: 600 },
		near: 0.1,
		far: 2000,
	})

	// --- Обработчик изменения размера окна ---
	window.addEventListener("resize", () => {
		renderer.setSize(window.innerWidth, window.innerHeight)
		viewPoint.setAspectRatio(window.innerWidth / window.innerHeight)
	})
	// --- Конец обработчика ---

	// --- Загрузка GLTF модели ---
	const loader = new GLTFLoader()
	// Загружаем модель с несколькими деталями и цветами
	const gltf = await loader.load(
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/2CylinderEngine/glTF/2CylinderEngine.gltf"
	)
	scene.add(gltf.scene)
	// --- Конец загрузки ---

	function animate() {
		requestAnimationFrame(animate)

		// Матрица объекта обновляется внутри рендерера
		renderer.render(scene, viewPoint)
	}

	animate()
})
