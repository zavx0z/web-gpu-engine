import { vec3, mat4 } from "gl-matrix"

/**
 * Параметры для создания камеры с перспективной проекцией.
 * 
 */
export interface PerspectiveCameraParameters {
	/**
	 * Угол обзора в радианах.
	 * @default 1
	 * @min 0
	 */
	fov?: number
	/**
	 * Соотношение сторон.
	 * @default 1
	 * @min 0
	 */
	aspect?: number
	/**
	 * Ближняя плоскость отсечения.
	 * @default 0.1
	 * @min 0
	 */
	near?: number
	/**
	 * Дальняя плоскость отсечения.
	 * @default 100
	 */
	far?: number
}

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
	 * @param parameters Параметры камеры.
	 */
	constructor(parameters: PerspectiveCameraParameters = {}) {
		const { fov = 1, aspect = 1, near = 0.1, far = 100 } = parameters

		if (fov <= 0) {
			throw new Error("Угол обзора (fov) должен быть больше нуля.")
		}
		if (aspect <= 0) {
			throw new Error("Соотношение сторон (aspect) должно быть больше нуля.")
		}
		if (near <= 0) {
			throw new Error(
				"Ближняя плоскость отсечения (near) должна быть больше нуля.",
			)
		}
		if (far <= near) {
			throw new Error(
				"Дальняя плоскость отсечения (far) должна быть больше ближней (near).",
			)
		}

		this.fov = fov
		this.aspect = aspect
		this.near = near
		this.far = far

		this.updateProjectionMatrix()
	}

	/**
	 * Обновляет матрицу проекции.
	 * Необходимо вызывать после изменения fov, aspect, near или far.
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
	 * Обновляет матрицу вида.
	 * @param target Точка, на которую смотрит камера.
	 * @param up Вектор, указывающий "верх" для камеры.
	 */
	public lookAt(target: vec3, up: vec3 = vec3.fromValues(0, 1, 0)): void {
		mat4.lookAt(this.viewMatrix, this.position, target, up)
	}
}
