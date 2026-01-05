import { Matrix4 } from "../math/Matrix4"
import { Vector3 } from "../math/Vector3"

/**
 * Параметры для создания точки обзора.
 */
export interface ViewPointParameters {
	element: HTMLElement
	fov?: number
	near?: number
	far?: number
	position?: { x: number; y: number; z: number }
	target?: { x: number; y: number; z: number }
}

const EPSILON = 1e-6

/**
 * Представляет точку обзора (камеру и управление) в 3D-пространстве.
 * Реализует орбитальное управление на основе сферических координат,
 * строго следуя контракту RH_ZO (Right-Handed, Z в [0, 1]).
 */
export class ViewPoint {
	public fov: number
	public aspect: number
	public near: number
	public far: number

	public position: Vector3 = new Vector3()
	public viewMatrix: Matrix4 = new Matrix4()
	public projectionMatrix: Matrix4 = new Matrix4()

	private element: HTMLElement
	private target: Vector3

	// Сферические координаты для орбитального вращения
	private radius: number
	private alpha: number // Горизонтальный угол (азимут)
	private beta: number  // Вертикальный угол (полярный)

	// Состояние ввода
	private isRotating = false
	private isPanning = false
	private lastX = 0
	private lastY = 0
	private lastTouchDistance: number | null = null

	constructor(parameters: ViewPointParameters) {
		this.element = parameters.element
		this.fov = parameters.fov ?? 1 // примерно 57 градусов
		this.near = parameters.near ?? 0.1
		this.far = parameters.far ?? 1000

		if (this.fov <= 0) throw new Error("Угол обзора (fov) должен быть больше нуля.")
		if (this.near <= 0) throw new Error("Ближняя плоскость отсечения (near) должна быть больше нуля.")
		if (this.far <= this.near) throw new Error("Дальняя плоскость отсечения (far) должна быть больше ближней (near).")

		this.aspect = this.element.clientWidth / this.element.clientHeight

		this.target = parameters.target ? new Vector3(parameters.target.x, parameters.target.y, parameters.target.z) : new Vector3(0, 0, 0)
		const initialPosition = parameters.position ? new Vector3(parameters.position.x, parameters.position.y, parameters.position.z) : new Vector3(0, 0, 10)

		// Инициализация сферических координат из начальной позиции
		const offset = new Vector3().subVectors(initialPosition, this.target)
		this.radius = offset.length()
		this.alpha = Math.atan2(offset.x, offset.z)
		this.beta = Math.acos(offset.y / this.radius)

		this.updateProjectionMatrix()
		this.attachEventListeners()
		this.update()
	}

	public setAspectRatio(aspect: number): void {
		if (aspect <= 0) return
		this.aspect = aspect
		this.updateProjectionMatrix()
	}

	public updateProjectionMatrix(): void {
		this.projectionMatrix.makePerspective(this.fov, this.aspect, this.near, this.far)
	}

	/**
	 * Пересчитывает позицию камеры из сферических координат и обновляет матрицу вида.
	 */
	public update = () => {
		const sinBeta = Math.sin(this.beta)
		const offset = new Vector3(
			this.radius * sinBeta * Math.sin(this.alpha),
			this.radius * Math.cos(this.beta),
			this.radius * sinBeta * Math.cos(this.alpha),
		)

		this.position.copy(this.target).add(offset)
		this.viewMatrix.makeLookAt(this.position, this.target, new Vector3(0, 1, 0))
	}

	public dispose() {
		this.element.removeEventListener("mousedown", this.onMouseDown)
		document.removeEventListener("mousemove", this.onMouseMove)
		document.removeEventListener("mouseup", this.onMouseUp)
		this.element.removeEventListener("wheel", this.onWheel)
		this.element.removeEventListener("contextmenu", this.preventContextMenu)
		this.element.removeEventListener("touchstart", this.onTouchStart)
		this.element.removeEventListener("touchend", this.onTouchEnd)
		this.element.removeEventListener("touchcancel", this.onTouchEnd)
		this.element.removeEventListener("touchmove", this.onTouchMove)
	}

	private attachEventListeners() {
		this.element.style.touchAction = "none"
		this.element.addEventListener("mousedown", this.onMouseDown)
		document.addEventListener("mousemove", this.onMouseMove)
		document.addEventListener("mouseup", this.onMouseUp)
		this.element.addEventListener("wheel", this.onWheel, { passive: false })
		this.element.addEventListener("contextmenu", this.preventContextMenu)

		this.element.addEventListener("touchstart", this.onTouchStart, { passive: false })
		this.element.addEventListener("touchend", this.onTouchEnd)
		this.element.addEventListener("touchcancel", this.onTouchEnd)
		this.element.addEventListener("touchmove", this.onTouchMove, { passive: false })
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

	private onTouchStart = (event: TouchEvent) => {
		event.preventDefault()
		const touches = event.touches

		switch (touches.length) {
			case 1:
				this.isRotating = true
				this.lastX = touches[0].clientX
				this.lastY = touches[0].clientY
				break
			case 2:
				this.isPanning = true
				const dx = touches[0].clientX - touches[1].clientX
				const dy = touches[0].clientY - touches[1].clientY
				this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy)
				this.lastX = (touches[0].clientX + touches[1].clientX) / 2
				this.lastY = (touches[0].clientY + touches[1].clientY) / 2
				break
			default:
				this.isRotating = false
				this.isPanning = false
		}
	}

	private onTouchMove = (event: TouchEvent) => {
		event.preventDefault()
		const touches = event.touches

		if (touches.length === 1 && this.isRotating) {
			const deltaX = touches[0].clientX - this.lastX
			const deltaY = touches[0].clientY - this.lastY
			this.handleRotation(deltaX, deltaY)
			this.lastX = touches[0].clientX
			this.lastY = touches[0].clientY
			this.update()
		} else if (touches.length === 2 && this.isPanning) {
			// Щипок (Pinch-to-Zoom)
			const dx = touches[0].clientX - touches[1].clientX
			const dy = touches[0].clientY - touches[1].clientY
			const currentTouchDistance = Math.sqrt(dx * dx + dy * dy)
			if (this.lastTouchDistance !== null) {
				const deltaDistance = currentTouchDistance - this.lastTouchDistance
				this.handleZoom(deltaDistance)
			}
			this.lastTouchDistance = currentTouchDistance

			// Панорамирование
			const currentMidX = (touches[0].clientX + touches[1].clientX) / 2
			const currentMidY = (touches[0].clientY + touches[1].clientY) / 2
			const deltaX = currentMidX - this.lastX
			const deltaY = currentMidY - this.lastY
			this.handlePan(deltaX, deltaY)
			this.lastX = currentMidX
			this.lastY = currentMidY

			this.update()
		}
	}

	private onTouchEnd = (event: TouchEvent) => {
		if (event.touches.length < 2) {
			this.isPanning = false
			this.lastTouchDistance = null
		}
		if (event.touches.length < 1) {
			this.isRotating = false
		}
	}

	private onWheel = (event: WheelEvent) => {
		event.preventDefault()
		if (event.ctrlKey) {
			this.handleZoom(-event.deltaY)
		} else {
			this.handlePan(event.deltaX, event.deltaY)
		}
		this.update()
	}

	/**
	 * Вращает камеру, изменяя сферические координаты.
	 */
	private handleRotation(deltaX: number, deltaY: number) {
		const rotationSpeed = 0.005
		this.alpha -= deltaX * rotationSpeed
		this.beta -= deltaY * rotationSpeed

		this.beta = Math.max(EPSILON, Math.min(Math.PI - EPSILON, this.beta))
	}

	/**
	 * Панорамирует камеру, сдвигая цель (target).
	 */
	private handlePan(deltaX: number, deltaY: number) {
		const panSpeed = 0.001 * this.radius

		const right = new Vector3(this.viewMatrix.elements[0], this.viewMatrix.elements[4], this.viewMatrix.elements[8])
		const up = new Vector3(this.viewMatrix.elements[1], this.viewMatrix.elements[5], this.viewMatrix.elements[9])

		const panOffset = right.multiplyScalar(deltaX * panSpeed).add(up.multiplyScalar(-deltaY * panSpeed))

		this.target.add(panOffset)
	}

	/**
	 * Масштабирует, изменяя радиус до цели.
	 * Положительный `delta` приближает, отрицательный — отдаляет.
	 */
	private handleZoom(delta: number) {
		const scale = Math.pow(0.95, delta * 0.05)
		this.radius *= scale
		this.radius = Math.max(0.1, this.radius)
	}
}
