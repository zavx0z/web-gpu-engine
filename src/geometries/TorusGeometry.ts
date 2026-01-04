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
	 * @param radius Радиус тора.
	 * @param tube Радиус "трубы" тора.
	 * @param radialSegments Количество радиальных сегментов.
	 * @param tubularSegments Количество трубчатых сегментов.
	 */
	constructor(
		radius: number = 0.5,
		tube: number = 0.2,
		radialSegments: number = 12,
		tubularSegments: number = 24,
	) {
		this.radius = radius
		this.tube = tube
		this.radialSegments = radialSegments
		this.tubularSegments = tubularSegments

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
