import { BufferGeometry } from "../core/BufferGeometry"
import { Float32BufferAttribute } from "../core/BufferAttribute"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"
import { LineSegments } from "../objects/LineSegments"

/**
 * Помощник для визуализации осей координат (X, Y, Z).
 * @see https://threejs.org/docs/#api/en/helpers/AxesHelper
 */
export class AxesHelper extends LineSegments {
    public type = "AxesHelper"

	/**
	 * @param size Длина осей. По умолчанию 1.
	 */
	constructor(size: number = 1) {
		const vertices = [
			0, 0, 0, size, 0, 0, 0, 0, 0, 0, size, 0, 0, 0, 0, 0, 0, size,
		]

		const colors = [
			1, 0, 0, 1, 0.6, 0, 0, 1, 0, 0.6, 1, 0, 0, 0, 1, 0, 0.6, 1,
		]

		const geometry = new BufferGeometry()
		geometry.setAttribute(
			"position",
			new Float32BufferAttribute(vertices, 3)
		)
		geometry.setAttribute("color", new Float32BufferAttribute(colors, 3))

		const material = new LineBasicMaterial({ vertexColors: true })

		super(geometry, material)
	}
}
