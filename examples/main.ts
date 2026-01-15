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
} from "../src/WebGPUEngine"

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
		position: { x: 0, y: 800, z: 1000 },
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
	const gltf = await loader.load(
		"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/2CylinderEngine/glTF/2CylinderEngine.gltf"
	)
	gltf.scene.position.set(0, 180, 0)
	gltf.scene.updateMatrix()
	scene.add(gltf.scene)
	// --- Конец загрузки ---

	function animate() {
		requestAnimationFrame(animate)

		// Матрица объекта обновляется внутри рендерера
		renderer.render(scene, viewPoint)
	}

	animate()
})
