import { Color } from "../math/Color"
import { Material } from "./Material"

/**
 * Параметры для создания MeshBasicMaterial.
 */
interface MeshBasicMaterialParameters {
	/**
	 * Цвет материала.
	 * @default 0xff00ff (ярко-розовый для отладки)
	 */
	color?: number | Color
}

/**
 * Простой материал, который отображает объекты сплошным цветом.
 */
export class MeshBasicMaterial extends Material {
	/**
	 * Цвет материала.
	 */
	public color: Color

	/**
	 * Создает экземпляр MeshBasicMaterial.
	 * @param {MeshBasicMaterialParameters} parameters - Параметры для материала.
	 */
	constructor(parameters: MeshBasicMaterialParameters = {}) {
		super()
		if (parameters.color instanceof Color) {
			this.color = parameters.color.clone()
		} else if (typeof parameters.color === 'number') {
			this.color = new Color(parameters.color)
		} else {
			// Меняем цвет по умолчанию на розовый для отладки
			this.color = new Color(0xff00ff)
		}
	}
}
