import { BufferAttribute, BufferGeometry } from "../core/BufferGeometry"

/**
 * Параметры для создания геометрии тора.
 */
interface TorusGeometryParameters {
	/**
	 * Радиус тора от центра до центра "трубы".
	 * @default 0.5
	 * @min 0
	 */
	radius?: number
	/**
	 * Радиус "трубы".
	 * @default 0.2
	 * @min 0
	 */
	tube?: number
	/**
	 * Количество сегментов по основной окружности тора. Целое число.
	 * @default 12
	 * @min 3
	 * @max 255
	 */
	radialSegments?: number
	/**
	 * Количество сегментов "трубы". Целое число.
	 * @default 12
	 * @min 3
	 * @max 255
	 */
	tubularSegments?: number
}

/**
 * Класс для создания геометрии тора.
 * @see https://threejs.org/docs/#api/en/geometries/TorusGeometry
 */
export class TorusGeometry extends BufferGeometry {
	/**
	 * @param parameters Параметры геометрии.
	 */
	constructor(parameters: TorusGeometryParameters = {}) {
		super()

		const {
			radius = 0.5,
			tube = 0.2,
			radialSegments = 12,
			tubularSegments = 12,
		} = parameters

		const vertices: number[] = []
		const indices: number[] = []

		for (let j = 0; j <= radialSegments; j++) {
			for (let i = 0; i <= tubularSegments; i++) {
				const u = (i / tubularSegments) * Math.PI * 2
				const v = (j / radialSegments) * Math.PI * 2

				const x = (radius + tube * Math.cos(v)) * Math.cos(u)
				const y = (radius + tube * Math.cos(v)) * Math.sin(u)
				const z = tube * Math.sin(v)

				vertices.push(x, y, z)
			}
		}

		for (let j = 1; j <= radialSegments; j++) {
			for (let i = 1; i <= tubularSegments; i++) {
				const a = (tubularSegments + 1) * j + i - 1
				const b = (tubularSegments + 1) * (j - 1) + i - 1
				const c = (tubularSegments + 1) * (j - 1) + i
				const d = (tubularSegments + 1) * j + i

				indices.push(a, b, d)
				indices.push(b, c, d)
			}
		}

		this.setIndex(new BufferAttribute(new Uint16Array(indices), 1))
		this.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3))
	}
}
