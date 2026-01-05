/**
 * Класс для представления кватернионов.
 */
export class Quaternion {
	public x: number
	public y: number
	public z: number
	public w: number

	/**
	 * Создает экземпляр Quaternion.
	 * @param {number} x - Значение по оси X.
	 * @param {number} y - Значение по оси Y.
	 * @param {number} z - Значение по оси Z.
	 * @param {number} w - Значение по оси W.
	 */
	constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
		this.x = x
		this.y = y
		this.z = z
		this.w = w
	}

	/**
	 * Устанавливает кватернион из углов Эйлера.
	 * @param {number} x - Угол вращения вокруг оси X в радианах.
	 * @param {number} y - Угол вращения вокруг оси Y в радианах.
	 * @param {number} z - Угол вращения вокруг оси Z в радианах.
	 */
	public setFromEuler(x: number, y: number, z: number): this {
		const c1 = Math.cos(x / 2)
		const c2 = Math.cos(y / 2)
		const c3 = Math.cos(z / 2)

		const s1 = Math.sin(x / 2)
		const s2 = Math.sin(y / 2)
		const s3 = Math.sin(z / 2)

		this.x = s1 * c2 * c3 + c1 * s2 * s3
		this.y = c1 * s2 * c3 - s1 * c2 * s3
		this.z = c1 * c2 * s3 + s1 * s2 * c3
		this.w = c1 * c2 * c3 - s1 * s2 * s3

		return this
	}

	/**
	 * Возвращает компоненты кватерниона в виде массива.
	 * @returns {[number, number, number, number]} Массив [x, y, z, w].
	 */
	public toArray(): [number, number, number, number] {
		return [this.x, this.y, this.z, this.w]
	}
}
