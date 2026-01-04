import { mat4 } from "gl-matrix"

/**
 * Базовый класс для большинства объектов в сцене.
 * @see https://threejs.org/docs/#api/en/core/Object3D
 */
export abstract class Object3D {
	public readonly isObject3D: true = true

	/**
	 * Локальная матрица трансформации.
	 */
	public modelMatrix: mat4 = mat4.create()

	/**
	 * Список дочерних объектов.
	 */
	public children: Object3D[] = []

	/**
	 * Строка, идентифицирующая тип объекта.
	 */
	abstract type: string

	/**
	 * Добавляет объект как дочерний к этому объекту.
	 * @param object Объект для добавления.
	 */
	public add(object: Object3D) {
		this.children.push(object)
	}
}
