import { mat4 } from "gl-matrix"
import type { TorusGeometry } from "../geometries/TorusGeometry"
import type { BasicMaterial } from "../materials/BasicMaterial"

/**
 * Представляет 3D-объект в сцене, состоящий из геометрии и материала.
 */
export class Mesh {
	/**
	 * Геометрия объекта.
	 */
	public geometry: TorusGeometry
	/**
	 * Материал объекта.
	 */
	public material: BasicMaterial
	/**
	 * Флаг, указывающий, что это объект Mesh.
	 */
	public readonly isMesh: boolean = true

	/**
	 * Матрица модели, определяющая положение, вращение и масштаб объекта в мире.
	 */
	public modelMatrix: mat4 = mat4.create()

	/**
	 * @param geometry Геометрия объекта (например, TorusGeometry).
	 * @param material Материал объекта (например, BasicMaterial).
	 */
	constructor(geometry: TorusGeometry, material: BasicMaterial) {
		this.geometry = geometry
		this.material = material
	}
}
