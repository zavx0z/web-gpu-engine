import { vec3, mat4 } from "gl-matrix"

/**
 * Камера с перспективной проекцией. Используется для создания эффекта глубины.
 */
export class PerspectiveCamera {
	/**
	 * Угол обзора в радианах.
	 */
	public fov: number
	/**
	 * Соотношение сторон.
	 */
	public aspect: number
	/**
	 * Ближняя плоскость отсечения.
	 */
	public near: number
	/**
	 * Дальняя плоскость отсечения.
	 */
	public far: number

	/**
	 * Позиция камеры в мировых координатах.
	 */
	public position: vec3 = vec3.create()
	/**
	 * Матрица вида. Определяет положение и ориентацию камеры в пространстве.
	 */
	public viewMatrix: mat4 = mat4.create()
	/**
	 * Матрица проекции. Преобразует 3D-координаты в 2D-координаты на экране.
	 */
	public projectionMatrix: mat4 = mat4.create()

	/**
	 * @param fov Угол обзора в радианах.
	 * @param aspect Соотношение сторон.
	 * @param near Ближняя плоскость отсечения.
	 * @param far Дальняя плоскость отсечения.
	 */
	constructor(fov: number, aspect: number, near: number, far: number) {
		this.fov = fov
		this.aspect = aspect
		this.near = near
		this.far = far

		this.updateProjectionMatrix()
	}

	/**
	 * Обновляет матрицу проекции. Вызывается при изменении параметров камеры (fov, aspect, near, far).
	 */
	public updateProjectionMatrix(): void {
		mat4.perspective(
			this.projectionMatrix,
			this.fov,
			this.aspect,
			this.near,
			this.far,
		)
	}

	/**
	 * Направляет камеру на указанную точку.
	 * @param target Точка, на которую нужно направить камеру.
	 */
	public lookAt(target: vec3): void {
		mat4.lookAt(this.viewMatrix, this.position, target, [0, 1, 0])
	}
}
