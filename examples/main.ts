if (import.meta.hot) {
	import.meta.hot.accept()
}

import { AxesHelper, GLTFLoader, Scene, ViewPoint, WebGPURenderer, quat } from "../src/WebGPUEngine"

document.addEventListener("DOMContentLoaded", async () => {
	const renderer = new WebGPURenderer()
	await renderer.init()

	if (renderer.canvas) {
		document.body.appendChild(renderer.canvas)

		const scene = new Scene()

		const axesHelper = new AxesHelper({ size: 2 })
		scene.add(axesHelper)

		const viewPoint = new ViewPoint({
			element: renderer.canvas,
			fov: (2 * Math.PI) / 5,
		})

		// Загружаем модель
		const loader = new GLTFLoader()
		const gltf = await loader.load(
			"https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf"
		)
		scene.add(gltf.scene)

		function animate() {
			// Вращаем сцену модели, чтобы ее было видно со всех сторон
			quat.rotateY(gltf.scene.quaternion, gltf.scene.quaternion, 0.005)
			gltf.scene.updateMatrix() // Обновляем матрицу после вращения

			renderer.render(scene, viewPoint)
			requestAnimationFrame(animate)
		}

		function handleResize() {
			const width = window.innerWidth
			const height = window.innerHeight
			renderer.setSize(width, height)
			viewPoint.setAspectRatio(width, height)
		}

		window.addEventListener("resize", handleResize)

		handleResize()
		animate()
	}
})
