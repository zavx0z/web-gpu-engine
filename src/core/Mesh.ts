import { Object3D } from "./Object3D"
import { BufferGeometry } from "./BufferGeometry"
import { Material } from "../materials/Material"

/**
 * Класс для треугольных полигональных сеток.
 * @see https://threejs.org/docs/#api/en/objects/Mesh
 */
export class Mesh extends Object3D {
	public readonly isMesh: true = true
	public type = "Mesh"

	/**
	 * @param geometry Геометрия сетки.
	 * @param material Материал сетки.
	 */
	constructor(
		public geometry: BufferGeometry,
		public material: Material | Material[]
	) {
		super()
	}
}
