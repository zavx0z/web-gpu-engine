import type { Mesh } from "../core/Mesh"

/**
 * Представляет собой контейнер для 3D-объектов, источников света и камер.
 */
export class Scene {
	/**
	 * Массив дочерних объектов в сцене.
	 */
	public children: Mesh[] = []

	/**
	 * Добавляет объект в сцену.
	 * @param object Объект для добавления (например, Mesh).
	 */
	public add(object: Mesh): void {
		this.children.push(object)
	}
}
