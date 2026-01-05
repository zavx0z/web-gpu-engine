import { Object3D } from "./Object3D"
import { BufferGeometry } from "./BufferGeometry"
import { Material } from "../materials/Material"

/**
 * Класс для создания полигональных сеток (мешей).
 */
export class Mesh extends Object3D {
	/**
	 * Геометрия меша.
	 */
	public geometry: BufferGeometry
	/**
	 * Материал или массив материалов меша.
	 */
	public material: Material | Material[]

	/**
	 * Создает экземпляр Mesh.
	 * @param {BufferGeometry} geometry - Геометрия объекта.
	 * @param {Material | Material[]} material - Материал или массив материалов.
	 */
	constructor(geometry: BufferGeometry, material: Material | Material[]) {
		super()
		this.geometry = geometry
		this.material = material
	}
}
