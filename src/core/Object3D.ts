import { Matrix4 } from "../math/Matrix4"
import { Quaternion } from "../math/Quaternion"
import { Vector3 } from "../math/Vector3"

/**
 * Базовый класс для всех объектов в сцене.
 * Обеспечивает иерархическую структуру (граф сцены).
 */
export class Object3D {
	/**
	 * Позиция объекта в виде вектора {x, y, z}.
	 * @default new Vector3(0, 0, 0)
	 */
	public position: Vector3 = new Vector3()

	/**
	 * Кватернион, определяющий вращение объекта.
	 * @default new Quaternion()
	 */
	public quaternion: Quaternion = new Quaternion()

	// Внутреннее свойство для хранения вращения в углах Эйлера.
	private _rotation: Vector3 = new Vector3()

  /**
   * Вращение объекта в радианах в виде углов Эйлера {x, y, z}.
   * При изменении этого свойства автоматически обновляется `quaternion`.
   */
  get rotation(): Vector3 {
    return this._rotation
  }
  set rotation(value: Vector3) {
    this._rotation = value
    this.quaternion.setFromEuler(value.x, value.y, value.z)
  }

	/**
	 * Масштаб объекта в виде вектора {x, y, z}.
	 * @default new Vector3(1, 1, 1)
	 */
	public scale: Vector3 = new Vector3(1, 1, 1)

	/**
	 * Локальная матрица преобразования объекта.
	 * @default new Matrix4()
	 */
	public modelMatrix: Matrix4 = new Matrix4()

	/**
	 * Массив дочерних объектов.
	 */
	public children: Object3D[] = []

	/**
	 * Видимость объекта. Если false, объект не будет отрисован.
	 * @default true
	 */
	public visible: boolean = true

	/**
	 * Добавляет дочерний объект к этому объекту.
	 * @param {Object3D} child - Дочерний объект.
	 */
	public add(child: Object3D): void {
		this.children.push(child)
	}

  /**
   * Обновляет локальную матрицу преобразования объекта
   * на основе его позиции, кватерниона и масштаба.
   */
  public updateMatrix(): void {
    this.quaternion.setFromEuler(this._rotation.x, this._rotation.y, this._rotation.z)
    this.modelMatrix.compose(this.position, this.quaternion, this.scale)
  }
}
