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
} from "../src/WebGPUEngine"

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
		position: { x: 0, y: 800, z: 1000 },
		near: 0.1,
		far: 10000,
	})

	const grid = new GridHelper(1000, 20)
	scene.add(grid)

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
