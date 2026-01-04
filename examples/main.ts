if (import.meta.hot) {
	import.meta.hot.accept()
}

import {
	WebGPURenderer,
	Scene,
	PerspectiveCamera,
	Mesh,
	TorusGeometry,
	BasicMaterial,
	AxesHelper,
	OrbitControls,
	vec3,
	mat4, // Возвращаем импорт mat4
} from "../src/WebGPUEngine"

/**
 * Главная функция для инициализации и запуска WebGPU приложения.
 */
async function main() {
	// Создание и инициализация рендерера
	const renderer = new WebGPURenderer()
	await renderer.init()

	// Создание сцены
	const scene = new Scene()

	// Создание камеры
	const camera = new PerspectiveCamera({
		fov: (2 * Math.PI) / 5,
		aspect: window.innerWidth / window.innerHeight,
		near: 0.1,
		far: 100.0,
	})
	// СНАЧАЛА устанавливаем позицию камеры
	camera.position[2] = 2
	camera.lookAt(vec3.fromValues(0, 0, 0))

	// ПОТОМ создаем OrbitControls, чтобы он считал правильный начальный радиус
	const controls = new OrbitControls(camera, renderer.canvas!)

	// Создание геометрии и материала для тора
	const geometry = new TorusGeometry({
		radius: 0.4,
		tube: 0.2,
		radialSegments: 32,
		tubularSegments: 16,
	})
	const material = new BasicMaterial()
	const torus = new Mesh(geometry, material)

	// Добавление тора на сцену
	scene.add(torus)

	// Добавление осей координат
	const axesHelper = new AxesHelper(1)
	scene.add(axesHelper)

	// Обработчик изменения размера окна
	window.addEventListener("resize", () => {
		const width = window.innerWidth
		const height = window.innerHeight

		// Обновляем размер холста
		renderer.setSize(width, height)

		// Обновляем соотношение сторон камеры и матрицу проекции
		camera.aspect = width / height
		camera.updateProjectionMatrix()
	})

	/**
	 * Функция анимации, которая вызывается на каждом кадре.
	 */
	function animate() {
		// Вращаем тор вокруг своей оси Y
		mat4.rotate(torus.modelMatrix, torus.modelMatrix, 0.01, [0, 1, 0])

		// Контролы обновляют матрицу вида камеры на основе ввода пользователя
		controls.update()

		// Рендеринг сцены
		renderer.render(scene, camera)
		requestAnimationFrame(animate)
	}

	// Запуск анимации
	animate()
}

main()
