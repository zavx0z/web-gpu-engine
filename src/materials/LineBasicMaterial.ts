import { Color, ColorSource } from "../math/Color"
import { Material, MaterialParameters } from "./Material"

/**
 * Параметры для LineBasicMaterial.
 */
export interface LineBasicMaterialParameters extends MaterialParameters {
	/**
	 * Цвет линии.
	 * @default 0xffffff
	 */
	color?: ColorSource
	/**
	 * Использовать ли цвета вершин.
	 * @default false
	 */
	vertexColors?: boolean
}

/**
 * Материал для рисования простых линий.
 * @see https://threejs.org/docs/#api/en/materials/LineBasicMaterial
 */
export class LineBasicMaterial extends Material {
	public type = "LineBasicMaterial"

	/**
	 * Цвет линии.
	 */
	public color: Color = new Color(0xffffff)

	/**
	 * Использовать ли цвета вершин.
	 */
	public vertexColors: boolean

	constructor(parameters: LineBasicMaterialParameters = {}) {
		super(parameters)

		if (parameters.color) {
			this.color.set(parameters.color)
		}

		this.vertexColors = parameters.vertexColors ?? false
	}
}
