/**
 * Простой материал, который использует сплошной цвет.
 */
export class BasicMaterial {
	/**
	 * Цвет материала в формате RGBA.
	 */
	public color: number[]

	/**
	 * @param options Опции для материала.
	 */
	constructor(options: { color?: number[] } = {}) {
		this.color = options.color || [1, 1, 1, 1]
	}
}
