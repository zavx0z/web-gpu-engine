import { Matrix4 } from "../math/Matrix4"
import { Quaternion } from "../math/Quaternion"
import { Vector3 } from "../math/Vector3"

/**
 * Базовый класс для всех объектов в сцене.
 * Обеспечивает иерархическую структуру (граф сцены).
 *
 * @remarks
 * Объекты наследуют систему координат **Z-up**:
 * * Позиция `.position` (x, y, z) — где Z это высота.
 * * Вращение `.rotation` / `.quaternion` применяется соответственно.
 */
export class Object3D {
  public name: string = ''
  public parent: Object3D | null = null
  public position: Vector3 = new Vector3()
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

  public scale: Vector3 = new Vector3(1, 1, 1)

  /**
   * Локальная матрица преобразования объекта.
   */
  public modelMatrix: Matrix4 = new Matrix4()
  public matrixWorld: Matrix4 = new Matrix4()

  public children: Object3D[] = []

  /**
   * Видимость объекта. Если false, объект не будет отрисован.
   */
  public visible: boolean = true

  /**
   * Добавляет дочерний объект в иерархию.
   *
   * @param child - Объект для добавления в качестве дочернего элемента
   */
  public add(child: Object3D): void {
    if (child.parent) {
      child.parent.children = child.parent.children.filter(c => c !== child);
    }
    this.children.push(child)
    child.parent = this
  }

  public getObjectByName(name: string): Object3D | undefined {
    if (this.name === name) return this;
    for (const child of this.children) {
        const object = child.getObjectByName(name);
        if (object !== undefined) {
            return object;
        }
    }
    return undefined;
  }

  public traverse(callback: (object: Object3D) => void) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  /**
   * Обновляет локальную матрицу преобразования объекта
   * на основе его позиции, кватерниона и масштаба.
   */
  public updateMatrix(): void {
    this.quaternion.setFromEuler(this.rotation.x, this.rotation.y, this.rotation.z);
    this.modelMatrix.compose(this.position, this.quaternion, this.scale);
  }

  public updateWorldMatrix(force: boolean = false): void {
    this.updateMatrix();

    if (this.parent) {
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.modelMatrix);
    } else {
      this.matrixWorld.copy(this.modelMatrix);
    }

    for (const child of this.children) {
      child.updateWorldMatrix(force);
    }
  }
}