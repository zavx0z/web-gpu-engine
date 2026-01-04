import type { PerspectiveCamera } from "../cameras/PerspectiveCamera"
import { vec3 } from "gl-matrix"

/**
 * Управляет камерой в стиле "Orbit Controls", позволяя вращать, панорамировать и масштабировать вид.
 *
 * ### Управление:
 * - **Вращение:** Зажать левую кнопку мыши и двигать / Двигать одним пальцем по тачпаду.
 * - **Масштабирование:** Прокрутка колесика мыши / Жест "щипок" на тачпаде.
 * - **Панорамирование (Перемещение):** Зажать правую кнопку мыши и двигать / Смахивать двумя пальцами по тачпаду.
 */
export class OrbitControls {
	private camera: PerspectiveCamera
	private element: HTMLElement

	private target: vec3 = vec3.create()

	// Состояния
	private isRotating = false // Вращение (левая кнопка / один палец)
	private isPanning = false // Панорамирование (правая кнопка)

	private lastX = 0
	private lastY = 0

	// Сферические координаты
	private phi = Math.PI / 2
	private theta = 0
	private radius = 2

	/**
	 * @param camera Камера для управления.
	 * @param element HTML-элемент для отслеживания событий мыши (обычно canvas).
	 */
	constructor(camera: PerspectiveCamera, element: HTMLElement) {
		this.camera = camera
		this.element = element

		this.radius = vec3.distance(camera.position, this.target)

		this.element.addEventListener("mousedown", this.onMouseDown)
		document.addEventListener("mousemove", this.onMouseMove)
		document.addEventListener("mouseup", this.onMouseUp)
		this.element.addEventListener("wheel", this.onWheel)
		this.element.addEventListener("contextmenu", (e) => e.preventDefault())

		this.update()
	}

	private onMouseDown = (event: MouseEvent) => {
		event.preventDefault()
		if (event.button === 0) {
			this.isRotating = true
		} else if (event.button === 2) {
			this.isPanning = true
		}
		this.lastX = event.clientX
		this.lastY = event.clientY
	}

	private onMouseMove = (event: MouseEvent) => {
		if (!this.isRotating && !this.isPanning) return

		const deltaX = event.clientX - this.lastX
		const deltaY = event.clientY - this.lastY

		if (this.isRotating) {
			this.handleRotation(deltaX, deltaY)
		} else if (this.isPanning) {
			this.handlePan(deltaX, deltaY)
		}

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

		// Щипок на тачпаде (в Chrome/Safari на macOS) определяется как wheel-событие с зажатым Ctrl.
		if (event.ctrlKey) {
			this.handleZoom(event.deltaY)
		} else {
			// Свайп двумя пальцами по тачпаду ИЛИ обычное колесико мыши.
			const isTrackpadPan = event.deltaX !== 0 || event.deltaY !== 0
			if (isTrackpadPan) {
				this.handlePan(event.deltaX, event.deltaY)
			} else {
				this.handleZoom(event.deltaY)
			}
		}
		this.update()
	}

	private handleRotation(deltaX: number, deltaY: number) {
		this.theta -= deltaX * 0.005
		this.phi -= deltaY * 0.005
		this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi))
	}

	private handlePan(deltaX: number, deltaY: number) {
		const panSpeed = 0.001 * this.radius
		const panOffset = vec3.create()

		const cameraMatrix = this.camera.viewMatrix
		// Векторы "вправо" и "вверх" извлекаются из СТОЛБЦОВ матрицы вида.
		const right = vec3.fromValues(cameraMatrix[0], cameraMatrix[4], cameraMatrix[8])
		const up = vec3.fromValues(cameraMatrix[1], cameraMatrix[5], cameraMatrix[9])

		vec3.scale(right, right, -deltaX * panSpeed)
		vec3.scale(up, up, deltaY * panSpeed)

		vec3.add(panOffset, panOffset, right)
		vec3.add(panOffset, panOffset, up)
		vec3.add(this.target, this.target, panOffset)
	}

	private handleZoom(deltaY: number) {
		this.radius += deltaY * 0.01
		this.radius = Math.max(0.5, this.radius)
	}

	/**
	 * Обновляет позицию камеры на основе текущих сферических координат (phi, theta, radius) и целевой точки (target).
	 * Этот метод должен вызываться в каждом кадре анимации для применения изменений.
	 */
	public update = () => {
		const offset = vec3.create()
		offset[0] = this.radius * Math.sin(this.phi) * Math.sin(this.theta)
		offset[1] = this.radius * Math.cos(this.phi)
		offset[2] = this.radius * Math.sin(this.phi) * Math.cos(this.theta)

		vec3.add(this.camera.position, this.target, offset)
		this.camera.lookAt(this.target)
	}

	/**
	 * Удаляет все слушатели событий, добавленные контроллером.
	 * Вызывайте этот метод при уничтожении объекта контролов, чтобы избежать утечек памяти.
	 */
	public dispose() {
		this.element.removeEventListener("mousedown", this.onMouseDown)
		document.removeEventListener("mousemove", this.onMouseMove)
		document.removeEventListener("mouseup", this.onMouseUp)
		this.element.removeEventListener("wheel", this.onWheel)
		this.element.removeEventListener("contextmenu", (e) => e.preventDefault())
	}
}
