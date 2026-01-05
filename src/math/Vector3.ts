import { Quaternion } from "./Quaternion"

/**
 * Класс для представления 3D-векторов.
 */
export class Vector3 {
	public x: number
	public y: number
	public z: number

	/**
	 * Создает экземпляр Vector3.
	 * @param {number} x - Значение по оси X.
	 * @param {number} y - Значение по оси Y.
	 * @param {number} z - Значение по оси Z.
	 */
	constructor(x: number = 0, y: number = 0, z: number = 0) {
		this.x = x
		this.y = y
		this.z = z
	}

	/**
	 * Устанавливает значения компонент вектора.
	 * @param {number} x - Значение по оси X.
	 * @param {number} y - Значение по оси Y.
	 * @param {number} z - Значение по оси Z.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public set(x: number, y: number, z: number): this {
		this.x = x
		this.y = y
		this.z = z
		return this
	}

	/**
	 * Копирует значения из другого вектора в этот вектор.
	 * @param {Vector3} v - Вектор, из которого копируются значения.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public copy(v: Vector3): this {
		this.x = v.x
		this.y = v.y
		this.z = v.z
		return this
	}

	/**
	 * Создает новый экземпляр Vector3 с такими же значениями.
	 * @returns {Vector3} Новый вектор.
	 */
	public clone(): Vector3 {
		return new Vector3(this.x, this.y, this.z)
	}

	/**
	 * Добавляет вектор к текущему вектору.
	 * @param {Vector3} v - Вектор для добавления.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public add(v: Vector3): this {
		this.x += v.x
		this.y += v.y
		this.z += v.z
		return this
	}

	/**
	 * Вычитает вектор из текущего вектора.
	 * @param {Vector3} v - Вектор для вычитания.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public sub(v: Vector3): this {
		this.x -= v.x
		this.y -= v.y
		this.z -= v.z
		return this
	}

	/**
	 * Устанавливает этот вектор как разность двух векторов.
	 * @param {Vector3} a - Первый вектор.
	 * @param {Vector3} b - Второй вектор.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public subVectors(a: Vector3, b: Vector3): this {
		this.x = a.x - b.x
		this.y = a.y - b.y
		this.z = a.z - b.z
		return this
	}

	/**
	 * Умножает текущий вектор на скаляр.
	 * @param {number} s - Скаляр.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public multiplyScalar(s: number): this {
		this.x *= s
		this.y *= s
		this.z *= s
		return this
	}

	/**
	 * Вычисляет скалярное произведение этого вектора и вектора v.
	 * @param {Vector3} v - Другой вектор.
	 * @returns {number} Скалярное произведение.
	 */
	public dot(v: Vector3): number {
		return this.x * v.x + this.y * v.y + this.z * v.z
	}

	/**
	 * Устанавливает этот вектор как векторное произведение векторов a и b.
	 * @param {Vector3} a - Первый вектор.
	 * @param {Vector3} b - Второй вектор.
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public crossVectors(a: Vector3, b: Vector3): this {
		const ax = a.x, ay = a.y, az = a.z
		const bx = b.x, by = b.y, bz = b.z

		this.x = ay * bz - az * by
		this.y = az * bx - ax * bz
		this.z = ax * by - ay * bx

		return this
	}

	/**
	 * Вычисляет длину вектора.
	 * @returns {number} Длина вектора.
	 */
	public length(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
	}

	/**
	 * Нормализует вектор (его длина становится равной 1).
	 * @returns {this} Текущий экземпляр вектора.
	 */
	public normalize(): this {
		const len = this.length()
		return this.multiplyScalar(len > 0 ? 1 / len : 0)
	}

	/**
	 * Возвращает компоненты вектора в виде массива.
	 * @returns {[number, number, number]} Массив [x, y, z].
	 */
	public toArray(): [number, number, number] {
		return [this.x, this.y, this.z]
	}

	/**
	 * Применяет к вектору вращение, заданное кватернионом.
	 * @param q Кватернион.
	 */
	public applyQuaternion(q: Quaternion): this {
		const x = this.x, y = this.y, z = this.z
		const qx = q.x, qy = q.y, qz = q.z, qw = q.w

		// Вычисление uv = 2.0 * cross(q.xyz, v)
		const uvx = 2 * (qy * z - qz * y)
		const uvy = 2 * (qz * x - qx * z)
		const uvz = 2 * (qx * y - qy * x)

		// Вычисление v + q.w * uv + cross(q.xyz, uv)
		this.x = x + qw * uvx + (qy * uvz - qz * uvy)
		this.y = y + qw * uvy + (qz * uvx - qx * uvz)
		this.z = z + qw * uvz + (qx * uvy - qy * uvx)

		return this
	}

	/**
	 * Инвертирует вектор (умножает все компоненты на -1).
	 */
	public negate(): this {
		this.x = -this.x
		this.y = -this.y
		this.z = -this.z
		return this
	}
}
