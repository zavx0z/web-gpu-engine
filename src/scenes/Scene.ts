import { Object3D } from "../core/Object3D"

/**
 * Класс для создания сцен.
 * @see https://threejs.org/docs/#api/en/scenes/Scene
 */
export class Scene extends Object3D {
	public readonly isScene: true = true
	public type = "Scene"

	constructor() {
		super()
	}
}
