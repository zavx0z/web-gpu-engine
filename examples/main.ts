if (import.meta.hot) {
	import.meta.hot.accept()
}

import { mat4 } from "gl-matrix"
import { AxesHelper } from "../src/helpers/AxesHelper"
import { BasicMaterial, Mesh, Scene, TorusGeometry, ViewPoint, WebGPURenderer } from "../src/WebGPUEngine"

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

		const geometry = new TorusGeometry({ radius: 0.5, tube: 0.2, radialSegments: 32, tubularSegments: 24 })
		const material = new BasicMaterial({ color: [1.0, 0.8, 0.0, 1.0], wireframe: true })
		const mesh = new Mesh({ geometry, material })
		scene.add(mesh)

		const modelMatrix = mat4.create()

		function animate() {
			mat4.rotateY(modelMatrix, modelMatrix, 0.01)
			mesh.modelMatrix = modelMatrix

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
