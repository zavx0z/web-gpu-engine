import { Matrix4 } from "../math/Matrix4"
import { Vector3 } from "../math/Vector3"

/**
 * Параметры для создания точки обзора.
 */
export interface ViewPointParameters {
	/** HTML-элемент для отслеживания событий ввода (обычно canvas). */
	element: HTMLElement
	/**
	 * Угол обзора в радианах.
	 * @default 1
	 * @min 0
	 */
	fov?: number
	/**
	 * Ближняя плоскость отсечения.
	 * @default 0.1
	 * @min 0
	 */
	near?: number
	/**
	 * Дальняя плоскость отсечения.
	 * @default 1000
	 */
	far?: number
	/**
	 * Начальная позиция камеры.
	 */
	position?: { x: number; y: number; z: number }
}

/**
 * Представляет точку обзора в 3D-пространстве, объединяя функциональность
 * камеры с перспективной проекцией и управления в стиле OrbitControls.
 *
 * ### Управление:
 * - **Вращение:** Зажать левую кнопку мыши и двигать / Двигать одним пальцем по тачпаду.
 * - **Масштабирование:** Прокрутка колесиком мыши / Жест "щипок" на тачпаде.
 * - **Панорамирование:** Зажать правую кнопку мыши и двигать / Смахивать двумя пальцами по тачпаду.
 */
export class ViewPoint {
	// Параметры камеры
	public fov: number
	public aspect: number
	public near: number
	public far: number

	// Матрицы и позиция
	public position: Vector3 = new Vector3()
	public viewMatrix: Matrix4 = new Matrix4()
	public projectionMatrix: Matrix4 = new Matrix4()

	// Параметры управления
	private element: HTMLElement
	private target: Vector3 = new Vector3()
	private up: Vector3 = new Vector3(0, 1, 0)

	// Состояния управления
	private isRotating = false
	private isPanning = false
	private lastX = 0
	private lastY = 0

	// Углы для turntable-орбиты (аналог Blender): yaw вокруг Y, pitch вокруг X.
	// pitch ограничен, чтобы камера не переворачивалась.
	private pitch = 0 // в радианах, [-maxPitch, +maxPitch]
	private yaw = 0 // в радианах, без ограничений
	private radius = 5

	/**
	 * @param parameters Параметры для создания точки обзора.
	 */
	constructor(parameters: ViewPointParameters) {
		this.element = parameters.element
		// Используем оператор nullish coalescing для безопасного присваивания значений по умолчанию.
		this.fov = parameters.fov ?? 1
		this.near = parameters.near ?? 0.1
		this.far = parameters.far ?? 1000 // Увеличено значение по умолчанию для надежности

		// Валидация параметров
		if (this.fov <= 0) throw new Error("Угол обзора (fov) должен быть больше нуля.")
		if (this.near <= 0) throw new Error("Ближняя плоскость отсечения (near) должна быть больше нуля.")
		if (this.far <= this.near) throw new Error("Дальняя плоскость отсечения (far) должна быть больше ближней (near).")

		// Вычисляем начальное соотношение сторон из размеров элемента
		this.aspect = this.element.clientWidth / this.element.clientHeight

		if (parameters.position) {
			const { x, y, z } = parameters.position
			this.radius = Math.sqrt(x * x + y * y + z * z)
			this.pitch = Math.asin(y / this.radius)
			this.yaw = Math.atan2(x, z)
		}

		this.updateProjectionMatrix()
		this.attachEventListeners()
		this.update()
	}

	/**
	 * Обновляет соотношение сторон и матрицу проекции.
	 * @param aspect Новое соотношение сторон (ширина / высота).
	 */
	public setAspectRatio(aspect: number): void {
		if (aspect <= 0) return
		this.aspect = aspect
		this.updateProjectionMatrix()
	}

	/** Обновляет матрицу проекции. */
	public updateProjectionMatrix(): void {
		this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far)
	}

	/**
	 * Обновляет позицию и матрицу вида.
	 *
	 * Важно: мы намеренно НЕ используем `makeLookAt()` при управлении камерой.
	 * Для turntable-навигации (как в Blender) матрица вида должна строиться
	 * детерминированно из yaw/pitch без "плавающего" ролла около полюсов.
	 */
	public update = () => {
		const sinYaw = Math.sin(this.yaw)
		const cosYaw = Math.cos(this.yaw)
		const sinPitch = Math.sin(this.pitch)
		const cosPitch = Math.cos(this.pitch)

		// Направление от камеры к цели (взгляд вперёд)
		const forward = new Vector3(sinYaw * cosPitch, sinPitch, cosYaw * cosPitch)
		const offset = forward.clone().multiplyScalar(this.radius)

		this.position.copy(this.target).sub(offset)

		// Базис камеры без ролла (turntable): right всегда горизонтален
		const right = new Vector3(cosYaw, 0, -sinYaw)
		const up = new Vector3(-sinYaw * sinPitch, cosPitch, -cosYaw * sinPitch)
		const back = forward.clone().multiplyScalar(-1)

		const te = this.viewMatrix.elements
		// column-major
		te[0] = right.x
		te[4] = up.x
		te[8] = back.x
		te[12] = -right.dot(this.position)
		te[1] = right.y
		te[5] = up.y
		te[9] = back.y
		te[13] = -up.dot(this.position)
		te[2] = right.z
		te[6] = up.z
		te[10] = back.z
		te[14] = -back.dot(this.position)
		te[3] = 0
		te[7] = 0
		te[11] = 0
		te[15] = 1
	}

	/** Удаляет слушатели событий во избежание утечек памяти. */
	public dispose() {
		this.element.removeEventListener("mousedown", this.onMouseDown)
		document.removeEventListener("mousemove", this.onMouseMove)
		document.removeEventListener("mouseup", this.onMouseUp)
		this.element.removeEventListener("wheel", this.onWheel)
		this.element.removeEventListener("contextmenu", this.preventContextMenu)
	}

	private attachEventListeners() {
		this.element.addEventListener("mousedown", this.onMouseDown)
		document.addEventListener("mousemove", this.onMouseMove)
		document.addEventListener("mouseup", this.onMouseUp)
		this.element.addEventListener("wheel", this.onWheel, { passive: false })
		this.element.addEventListener("contextmenu", this.preventContextMenu)
	}

	private preventContextMenu = (e: Event) => e.preventDefault()

	private onMouseDown = (event: MouseEvent) => {
		event.preventDefault()
		if (event.button === 0) this.isRotating = true
		else if (event.button === 2) this.isPanning = true
		this.lastX = event.clientX
		this.lastY = event.clientY
	}

	private onMouseMove = (event: MouseEvent) => {
		if (!this.isRotating && !this.isPanning) return

		const deltaX = event.clientX - this.lastX
		const deltaY = event.clientY - this.lastY

		if (this.isRotating) this.handleRotation(deltaX, deltaY)
		else if (this.isPanning) this.handlePan(deltaX, deltaY)

		this.lastX = event.clientX
		this.lastY = event.clientY
		this.update()
	}

	private onMouseUp = () => {
		this.isRotating = false
		this.isPanning = false
	}

	private onWheel = (event: WheelEvent) => {
		event.preventDefault()
		// Жесты трекпада:
		// - обычный двухпальцевый скролл — панорамирование;
		// - pinch — зум. На macOS pinch, как правило, даёт ctrlKey=true.
		if (event.ctrlKey) {
			this.handleZoom(event.deltaY)
		} else {
			this.handlePan(event.deltaX, event.deltaY)
		}
		this.update()
	}

	/**
	 * Обрабатывает вращение камеры на основе смещения курсора.
	 * @param deltaX Смещение по горизонтали.
	 * @param deltaY Смещение по вертикали.
	 */
	private handleRotation(deltaX: number, deltaY: number) {
		const rotationSpeed = 0.005
		// Инвертированное ощущение: вправо — вправо, вверх — вверх.
		this.yaw += deltaX * rotationSpeed
		this.pitch += deltaY * rotationSpeed

		// Полностью свободная орбита вокруг объекта (как в Blender по умолчанию):
		// без ограничений по вертикали, камера может обойти объект с любой стороны.
		const twoPi = Math.PI * 2
		this.yaw = ((this.yaw % twoPi) + twoPi) % twoPi
	}

	/**
	 * Обрабатывает панорамирование (перемещение точки обзора) в экранных координатах.
	 *
	 * Жесты интерпретируются так:
	 * - движение двумя пальцами вправо (deltaX > 0) смещает ViewPoint вправо, объект уезжает влево;
	 * - движение двумя пальцами вверх (deltaY < 0 на Mac) смещает ViewPoint вверх, объект уезжает вниз.
	 *
	 * Для этого мы работаем не в мировых осях, а в базисе самой камеры.
	 * @param deltaX Смещение жеста по горизонтали в экранных координатах.
	 * @param deltaY Смещение жеста по вертикали в экранных координатах.
	 */
	private handlePan(deltaX: number, deltaY: number) {
		// Скорость панорамирования зависит от расстояния до цели, чтобы ощущение было одинаковым
		const panSpeed = 0.001 * this.radius

		const sinYaw = Math.sin(this.yaw)
		const cosYaw = Math.cos(this.yaw)
		const sinPitch = Math.sin(this.pitch)
		const cosPitch = Math.cos(this.pitch)

		// Базис камеры в turntable-режиме
		const right = new Vector3(cosYaw, 0, -sinYaw)
		const up = new Vector3(-sinYaw * sinPitch, cosPitch, -cosYaw * sinPitch)

		// deltaX > 0 — двигаем ViewPoint вправо → объект визуально едет влево
		const moveRight = right.multiplyScalar(deltaX * panSpeed)
		// На Mac при "натуральном" скролле жест вверх даёт deltaY < 0.
		// Мы хотим, чтобы объект уезжал вниз, значит ViewPoint должен сместиться вверх.
		const moveUp = up.multiplyScalar(-deltaY * panSpeed)

		this.target.add(moveRight).add(moveUp)
	}

	/**
	 * Обрабатывает масштабирование (приближение/отдаление).
	 * @param deltaY Значение прокрутки по оси Y.
	 */
	private handleZoom(deltaY: number) {
		// Используем Math.pow для плавного и пропорционального масштабирования.
		// Инвертируем направление жеста pinch: разводим пальцы — приближение.
		const scale = Math.pow(0.95, -deltaY * 0.02)
		this.radius *= scale
		// Ограничиваем минимальный радиус, чтобы камера не "влетела" внутрь цели.
		this.radius = Math.max(0.5, this.radius)
	}
}
