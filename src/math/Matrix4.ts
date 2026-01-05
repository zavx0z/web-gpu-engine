import { Quaternion } from "./Quaternion"
import { Vector3 } from "./Vector3"

/**
 * Представляет матрицу 4x4 в основном столбцовом порядке (column-major order).
 * Этот формат используется в WebGL/WebGPU для матричных операций.
 */
export class Matrix4 {
	public elements: number[]

	/**
	 * Инициализирует новую матрицу 4x4 как единичную матрицу.
	 */
	constructor() {
		// prettier-ignore
		this.elements = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		]
	}

	/**
	 * Устанавливает матрицу в состояние единичной матрицы.
	 * @returns {this} Текущий экземпляр матрицы.
	 */
	public identity(): this {
		// prettier-ignore
		this.elements = [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		]
		return this
	}

	/**
	 * Копирует значения из другой матрицы в эту.
	 * @param m Матрица, из которой копируются значения.
	 */
	public copy(m: Matrix4): this {
		this.elements = m.elements.slice()
		return this
	}

	/**
	 * Устанавливает позицию (смещение) этой матрицы.
	 * @param x X-координата.
	 * @param y Y-координата.
	 * @param z Z-координата.
	 */
	public setPosition(x: number, y: number, z: number): this {
		const te = this.elements
		te[12] = x
		te[13] = y
		te[14] = z
		return this
	}

	/**
	 * Создает матрицу вида (view matrix), направленную из `eye` в `target`.
	 * @param eye Позиция камеры.
	 * @param target Точка, на которую смотрит камера.
	 * @param up Вектор, указывающий "вверх".
	 */
	public makeLookAt(eye: Vector3, target: Vector3, up: Vector3): this {
		const z = new Vector3().subVectors(eye, target)

		// Если eye == target, выбираем произвольное направление, чтобы избежать NaN.
		if (z.length() === 0) {
			z.z = 1
		}

		z.normalize()

		// Handedness doesn't matter here, as we are just looking for perpendicular vectors.
		let x = new Vector3().crossVectors(up, z)

		// Если up почти параллелен направлению взгляда, базис становится вырожденным,
		// что проявляется как дрожание около "полюсов". Подбираем запасной up.
		if (x.length() < 1e-6) {
			const fallbackUp = Math.abs(z.z) < 0.999 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0)
			x = new Vector3().crossVectors(fallbackUp, z)
		}

		x.normalize()
		const y = new Vector3().crossVectors(z, x).normalize()

		const te = this.elements
		// prettier-ignore
		{
			te[0] = x.x; te[4] = y.x; te[8] = z.x; te[12] = -x.dot(eye);
			te[1] = x.y; te[5] = y.y; te[9] = z.y; te[13] = -y.dot(eye);
			te[2] = x.z; te[6] = y.z; te[10] = z.z; te[14] = -z.dot(eye);
			te[3] = 0;   te[7] = 0;   te[11] = 0;   te[15] = 1;
		}

		return this
	}

	/**
	 * Умножает эту матрицу на другую (this = this * m).
	 * @param m Матрица для умножения.
	 */
	public multiply(m: Matrix4): this {
		return this.multiplyMatrices(this, m)
	}

	/**
	 * Умножает эту матрицу на другую слева (this = m * this).
	 * @param m Матрица для умножения.
	 */
	public premultiply(m: Matrix4): this {
		return this.multiplyMatrices(m, this)
	}

	/**
	 * Устанавливает эту матрицу как результат умножения двух матриц (a * b).
	 * @param a Левая матрица.
	 * @param b Правая матрица.
	 */
	public multiplyMatrices(a: Matrix4, b: Matrix4): this {
		const ae = a.elements
		const be = b.elements
		const te = this.elements

		const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12]
		const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13]
		const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14]
		const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15]

		const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12]
		const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13]
		const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14]
		const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15]

		te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
		te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
		te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
		te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44

		te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
		te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
		te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
		te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44

		te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
		te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
		te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
		te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44

		te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
		te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
		te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
		te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44

		return this
	}

	/**
	 * Создает матрицу из позиции, кватерниона и масштаба.
	 * @param position Вектор позиции.
	 * @param quaternion Кватернион вращения.
	 * @param scale Вектор масштаба.
	 */
	public compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this {
		const te = this.elements

		const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w
		const x2 = x + x, y2 = y + y, z2 = z + z
		const xx = x * x2, xy = x * y2, xz = x * z2
		const yy = y * y2, yz = y * z2, zz = z * z2
		const wx = w * x2, wy = w * y2, wz = w * z2

		const sx = scale.x, sy = scale.y, sz = scale.z

		te[0] = (1 - (yy + zz)) * sx
		te[1] = (xy + wz) * sx
		te[2] = (xz - wy) * sx
		te[3] = 0

		te[4] = (xy - wz) * sy
		te[5] = (1 - (xx + zz)) * sy
		te[6] = (yz + wx) * sy
		te[7] = 0

		te[8] = (xz + wy) * sz
		te[9] = (yz - wx) * sz
		te[10] = (1 - (xx + yy)) * sz
		te[11] = 0

		te[12] = position.x
		te[13] = position.y
		te[14] = position.z
		te[15] = 1

		return this
	}

	/**
	 * Создает матрицу перспективной проекции, совместимую с WebGPU (Z-координаты в диапазоне [0, 1]).
	 * @param {number} fov - Угол обзора в радианах.
	 * @param {number} aspect - Соотношение сторон.
	 * @param {number} near - Ближняя плоскость отсечения.
	 * @param {number} far - Дальняя плоскость отсечения.
	 * @returns {this} Текущий экземпляр матрицы.
	 */
	public makePerspective(fov: number, aspect: number, near: number, far: number): this {
		const te = this.elements
		const f = 1.0 / Math.tan(fov / 2)

		te[0] = f / aspect
		te[1] = 0
		te[2] = 0
		te[3] = 0
		te[4] = 0
		te[5] = f
		te[6] = 0
		te[7] = 0
		te[8] = 0
		te[9] = 0
		te[11] = -1
		te[12] = 0
		te[13] = 0
		te[15] = 0

		if (far !== null && far !== Infinity) {
			const nf = 1 / (near - far)
			// WebGPU/Vulkan/Metal-style projection matrix
			te[10] = far * nf
			te[14] = far * near * nf
		} else {
			// Infinite projection
			te[10] = -1
			te[14] = -near
		}

		return this
	}
}
