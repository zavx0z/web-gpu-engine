import { BufferGeometry } from "../core/BufferGeometry"
import { Float32BufferAttribute } from "../core/BufferAttribute"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"
import { LineSegments } from "../objects/LineSegments"

/**
 * Параметры для создания AxesHelper.
 */
interface AxesHelperParameters {
	/**
	 * Длина осей.
	 * @default 1
	 * @min 0
	 */
	size?: number
}

/**
 * Помощник для визуализации осей координат (X, Y, Z).
 * @see https://threejs.org/docs/#api/en/helpers/AxesHelper
 */
export class AxesHelper extends LineSegments {
	public type = "AxesHelper"

	/**
	 * @param parameters Параметры для создания помощника.
	 */
	constructor(parameters: AxesHelperParameters = {}) {
		const { size = 1 } = parameters

		if (size < 0) {
			throw new Error("Размер не может быть отрицательным")
		}

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
