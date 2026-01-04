import { vec3, mat4 } from "gl-matrix"

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
	 * @default 100
	 */
	far?: number
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
	public position: vec3 = vec3.create()
	public viewMatrix: mat4 = mat4.create()
	public projectionMatrix: mat4 = mat4.create()

	// Параметры управления
	private element: HTMLElement
	private target: vec3 = vec3.create()

	// Состояния управления
	private isRotating = false
	private isPanning = false
	private lastX = 0
	private lastY = 0

	// Сферические координаты для OrbitControls
	private phi = Math.PI / 2
	private theta = 0
	private radius = 5

	/**
	 * @param parameters Параметры для создания точки обзора.
	 */
	constructor(parameters: ViewPointParameters) {
		const { element, fov = 1, near = 0.1, far = 100 } = parameters

		this.element = element
		this.fov = fov
		this.near = near
		this.far = far

		// Валидация параметров
		if (fov <= 0) throw new Error("Угол обзора (fov) должен быть больше нуля.")
		if (near <= 0) throw new Error("Ближняя плоскость отсечения (near) должна быть больше нуля.")
		if (far <= near) throw new Error("Дальняя плоскость отсечения (far) должна быть больше ближней (near).")

		// Вычисляем начальное соотношение сторон из размеров элемента
		this.aspect = element.clientWidth / element.clientHeight

		this.updateProjectionMatrix()
		this.attachEventListeners()
		this.update()
	}

	/**
	 * Обновляет соотношение сторон и матрицу проекции.
	 * @param width Новая ширина элемента (в CSS-пикселях).
	 * @param height Новая высота элемента (в CSS-пикселях).
	 */
	public setAspectRatio(width: number, height: number): void {
		if (width <= 0 || height <= 0) return
		this.aspect = width / height
		this.updateProjectionMatrix()
	}

	/** Обновляет матрицу проекции. */
	public updateProjectionMatrix(): void {
		mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far)
	}

	/** Обновляет позицию и матрицу вида на основе текущих сферических координат. */
	public update = () => {
		const offset = vec3.create()
		offset[0] = this.radius * Math.sin(this.phi) * Math.sin(this.theta)
		offset[1] = this.radius * Math.cos(this.phi)
		offset[2] = this.radius * Math.sin(this.phi) * Math.cos(this.theta)

		vec3.add(this.position, this.target, offset)
		mat4.lookAt(this.viewMatrix, this.position, this.target, vec3.fromValues(0, 1, 0))
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

		// Жест "щипок" (pinch-to-zoom) на тачпаде эмулируется как wheel + Ctrl.
		if (event.ctrlKey) {
			this.handleZoom(event.deltaY)
		} else {
			// Для событий без Ctrl, различаем панорамирование на тачпаде и зум колесом мыши.
			// Тачпады обычно используют DOM_DELTA_PIXEL, мыши — DOM_DELTA_LINE.
			if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
				this.handlePan(event.deltaX, event.deltaY)
			} else {
				this.handleZoom(event.deltaY)
			}
		}
		this.update()
	}

	/**
	 * Обрабатывает вращение камеры на основе смещения курсора.
	 * @param deltaX Смещение по горизонтали.
	 * @param deltaY Смещение по вертикали.
	 */
	private handleRotation(deltaX: number, deltaY: number) {
		// Коэффициент 0.005 подобран для комфортной скорости вращения.
		this.theta -= deltaX * 0.005
		this.phi -= deltaY * 0.005

		// Ограничиваем угол phi, чтобы избежать "кувырка" камеры через полюса.
		// 0.1 — небольшой отступ от полного вертикального положения.
		this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi))
	}

	/**
	 * Обрабатывает панорамирование (перемещение) камеры.
	 * @param deltaX Смещение по горизонтали.
	 * @param deltaY Смещение по вертикали.
	 */
	private handlePan(deltaX: number, deltaY: number) {
		// Скорость панорамирования зависит от радиуса, чтобы движение ощущалось
		// одинаково быстрым независимо от отдаления от объекта.
		const panSpeed = 0.001 * this.radius
		const panOffset = vec3.create()

		// Получаем векторы "вправо" и "вверх" из текущей матрицы вида.
		// Это позволяет перемещаться в плоскости, перпендикулярной взгляду.
		const right = vec3.fromValues(this.viewMatrix[0], this.viewMatrix[4], this.viewMatrix[8])
		const up = vec3.fromValues(this.viewMatrix[1], this.viewMatrix[5], this.viewMatrix[9])

		// Смещаем цель в том же направлении, что и движение мыши/пальца,
		// создавая эффект "перемещения точки наблюдения".
		vec3.scale(right, right, deltaX * panSpeed)
		vec3.scale(up, up, -deltaY * panSpeed)

		vec3.add(panOffset, panOffset, right)
		vec3.add(panOffset, panOffset, up)
		vec3.add(this.target, this.target, panOffset)
	}

	/**
	 * Обрабатывает масштабирование (приближение/отдаление).
	 * @param deltaY Значение прокрутки по оси Y.
	 */
	private handleZoom(deltaY: number) {
		// Коэффициент 0.01 подобран для комфортной скорости масштабирования.
		this.radius += deltaY * 0.01
		// Ограничиваем минимальный радиус, чтобы камера не "влетела" внутрь цели.
		this.radius = Math.max(0.5, this.radius)
	}
}
