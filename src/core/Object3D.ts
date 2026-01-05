import { mat4, quat, vec3 } from "gl-matrix"

/**
 * Параметры для создания Object3D.
 */
export interface Object3DParameters {
	/**
	 * Имя объекта. Необязательно.
	 * @default ''
	 */
	name?: string
}

/**
 * Базовый класс для большинства объектов в сцене.
 * @see https://threejs.org/docs/#api/en/core/Object3D
 */
export class Object3D {
	public readonly isObject3D: true = true

	/**
	 * Имя объекта.
	 */
	public name: string

	/**
	 * Локальная матрица трансформации.
	 */
	public modelMatrix: mat4 = mat4.create()

	/**
	 * Позиция объекта.
	 */
	public position: vec3 = vec3.create()

	/**
	 * Кватернион, отвечающий за поворот.
	 */
	public quaternion: quat = quat.create()

	/**
	 * Масштаб объекта.
	 */
	public scale: vec3 = vec3.fromValues(1, 1, 1)

	/**
	 * Список дочерних объектов.
	 */
	public children: Object3D[] = []

	/**
	 * Строка, идентифицирующая тип объекта.
	 */
	public type = "Object3D"

	/**
	 * Видимость объекта. Если false, объект не будет отрисован.
	 * @default true
	 */
	public visible = true

	constructor(parameters: Object3DParameters = {}) {
		this.name = parameters.name ?? ""
	}

	/**
	 * Добавляет объект как дочерний к этому объекту.
	 * @param object Объект для добавления.
	 */
	public add(object: Object3D) {
		this.children.push(object)
	}

	/**
	 * Обновляет матрицу модели из позиции, кватерниона и масштаба.
	 */
	public updateMatrix() {
		mat4.fromRotationTranslationScale(
			this.modelMatrix,
			this.quaternion,
			this.position,
			this.scale
		)
	}
}
