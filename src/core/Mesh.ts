import { Object3D, Object3DParameters } from "./Object3D"
import { BufferGeometry } from "./BufferGeometry"
import { Material } from "../materials/Material"

/**
 * Параметры для создания полигональной сетки.
 */
export interface MeshParameters extends Object3DParameters {
	/**
	 * Геометрия сетки, определяющая ее форму.
	 */
	geometry: BufferGeometry
	/**
	 * Материал (или массив материалов), определяющий внешний вид сетки.
	 */
	material: Material | Material[]
}

/**
 * Класс для треугольных полигональных сеток.
 * @see https://threejs.org/docs/#api/en/objects/Mesh
 */
export class Mesh extends Object3D {
	public readonly isMesh: true = true
	public type = "Mesh"
	public geometry: BufferGeometry
	public material: Material | Material[]

	/**
	 * @param parameters Параметры для создания сетки.
	 */
	constructor(parameters: MeshParameters) {
		super(parameters)
		const { geometry, material } = parameters
		this.geometry = geometry
		this.material = material
	}
}
