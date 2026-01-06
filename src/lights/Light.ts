
import { Object3D } from '../core/Object3D'
import { Color } from '../math/Color'

/**
 * Абстрактный базовый класс для источников света.
 */
export class Light extends Object3D {
	/**
	 * Цвет источника света.
	 * @default new Color(0xffffff)
	 */
	public color: Color

	/**
	 * Интенсивность (яркость) источника света.
	 * @default 1
	 */
	public intensity: number

	/**
	 * @param color Цвет источника света.
	 * @param intensity Интенсивность света.
	 */
	constructor(color: number | Color = 0xffffff, intensity: number = 1) {
		super()
		this.color = new Color(color)
		this.intensity = intensity
	}
}
