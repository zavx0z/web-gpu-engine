import { Material, MaterialParameters } from "./Material"

/**
 * Параметры для конструктора BasicMaterial.
 */
export interface BasicMaterialParameters extends MaterialParameters {
	/**
	 * Цвет материала в формате RGBA.
	 * @default [1, 1, 1, 1]
	 */
	color?: number[]
	/**
	 * Отображать ли геометрию как каркас.
	 * @default false
	 */
	wireframe?: boolean
}

/**
 * Простой материал, который использует сплошной цвет.
 * @see https://threejs.org/docs/#api/en/materials/MeshBasicMaterial
 */
export class BasicMaterial extends Material {
	public type = "BasicMaterial"
	/**
	 * Цвет материала в формате RGBA.
	 */
	public color: number[]
	/**
	 * Отображать ли геометрию как каркас.
	 */
	public wireframe: boolean

	/**
	 * @param parameters Параметры материала.
	 */
	constructor(parameters: BasicMaterialParameters = {}) {
		super(parameters)
		this.color = parameters.color || [1, 1, 1, 1]
		this.wireframe = parameters.wireframe || false
	}
}
