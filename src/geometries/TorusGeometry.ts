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
	 * Радиус "трубы" тора.
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
	 * Количество сегментов по окружности "трубы". Целое число.
	 * @default 24
	 * @min 3
	 * @max 255
	 */
	tubularSegments?: number
}

/**
 * Генерирует геометрию для тора (бублика).
 */
export class TorusGeometry {
	/**
	 * Радиус тора.
	 */
	public radius: number
	/**
	 * Радиус "трубы" тора.
	 */
	public tube: number
	/**
	 * Количество радиальных сегментов.
	 */
	public radialSegments: number
	/**
	 * Количество трубчатых сегментов.
	 */
	public tubularSegments: number
	/**
	 * Вершины геометрии.
	 */
	public vertices: Float32Array
	/**
	 * Индексы вершин для построения геометрии.
	 */
	public indices: Uint16Array

	/**
	 * @param parameters Параметры для создания геометрии тора.
	 */
	constructor(parameters: TorusGeometryParameters = {}) {
		this.radius = parameters.radius ?? 0.5
		this.tube = parameters.tube ?? 0.2
		this.radialSegments = parameters.radialSegments ?? 12
		this.tubularSegments = parameters.tubularSegments ?? 24

		// Проверка корректности параметров
		if (this.radius < 0) {
			throw new Error("Радиус не может быть отрицательным.")
		}
		if (this.tube < 0) {
			throw new Error("Радиус трубы не может быть отрицательным.")
		}
		if (
			!Number.isInteger(this.radialSegments) ||
			this.radialSegments < 3 ||
			this.radialSegments > 255
		) {
			throw new Error(
				"Количество радиальных сегментов должно быть целым числом от 3 до 255.",
			)
		}
		if (
			!Number.isInteger(this.tubularSegments) ||
			this.tubularSegments < 3 ||
			this.tubularSegments > 255
		) {
			throw new Error(
				"Количество трубчатых сегментов должно быть целым числом от 3 до 255.",
			)
		}

		const vertices: number[] = []
		const indices: number[] = []

		for (let j = 0; j <= this.radialSegments; j++) {
			for (let i = 0; i <= this.tubularSegments; i++) {
				const u = (i / this.tubularSegments) * Math.PI * 2
				const v = (j / this.radialSegments) * Math.PI * 2

				const x = (this.radius + this.tube * Math.cos(v)) * Math.cos(u)
				const y = (this.radius + this.tube * Math.cos(v)) * Math.sin(u)
				const z = this.tube * Math.sin(v)

				vertices.push(x, y, z)
			}
		}

		for (let j = 1; j <= this.radialSegments; j++) {
			for (let i = 1; i <= this.tubularSegments; i++) {
				const a = (this.tubularSegments + 1) * j + i - 1
				const b = (this.tubularSegments + 1) * (j - 1) + i - 1
				const c = (this.tubularSegments + 1) * (j - 1) + i
				const d = (this.tubularSegments + 1) * j + i

				indices.push(a, b, d)
				indices.push(b, c, d)
			}
		}

		this.vertices = new Float32Array(vertices)
		this.indices = new Uint16Array(indices)
	}
}
