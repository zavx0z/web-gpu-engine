import { Vector3 } from "../math/Vector3"

/**
 * Типы TypedArray, которые можно использовать в BufferAttribute.
 */
type TypedArray = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int32Array | Int16Array | Int8Array

/**
 * Хранит данные для одного атрибута геометрии (например, позиции вершин, нормали, цвета и т.д.).
 */
export class BufferAttribute {
  /**
   * Массив с данными атрибута.
   */
  public array: TypedArray
  /**
   * Размер компонента атрибута (например, 3 для векторов vec3).
   */
  public itemSize: number
  /**
   * Количество элементов в массиве.
   */
  public count: number

  /**
   * Создает экземпляр BufferAttribute.
   * @param array - Массив с данными.
   * @param itemSize - Размер одного элемента.
   */
  constructor(array: TypedArray, itemSize: number) {
    this.array = array
    this.itemSize = itemSize
    this.count = array.length / itemSize
  }
}

/**
 * Представляет геометрию объекта. Содержит информацию о вершинах, индексах и других атрибутах.
 */
export class BufferGeometry {
  /**
   * Атрибуты геометрии, хранящиеся в виде пар "имя-атрибут".
   */
  public attributes: { [name: string]: BufferAttribute } = {}
  /**
   * Индексный буфер для геометрии.
   */
  public index: BufferAttribute | null = null

  /**
   * Устанавливает атрибут для геометрии.
   * @param name - Имя атрибута (например, "position").
   * @param attribute - Объект BufferAttribute.
   * @returns Возвращает этот экземпляр для чейнинга.
   */
  public setAttribute(name: string, attribute: BufferAttribute): this {
    this.attributes[name] = attribute
    return this
  }

  /**
   * Устанавливает индексный буфер для геометрии.
   * @param index - Объект BufferAttribute с индексами.
   * @returns Возвращает этот экземпляр для чейнинга.
   */
  public setIndex(index: BufferAttribute): this {
    this.index = index
    return this
  }

  /**
   * Вычисляет нормали для вершин на основе граней геометрии.
   * Предполагает, что геометрия индексирована и состоит из треугольников.
   */
  public computeVertexNormals(): void {
    const index = this.index
    const positionAttribute = this.attributes.position

    if (!positionAttribute) {
      console.error("BufferGeometry.computeVertexNormals(): отсутствует атрибут 'position'.")
      return
    }

    const normalAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3)

    const pA = new Vector3(),
      pB = new Vector3(),
      pC = new Vector3()
    const cb = new Vector3(),
      ab = new Vector3()

    if (!index) {
      console.error("BufferGeometry.computeVertexNormals(): поддерживается только индексированная геометрия.")
      return
    }

    const indices = index.array
    const positions = positionAttribute.array
    const normals = normalAttribute.array

    for (let i = 0, il = index.count; i < il; i += 3) {
      const vA = indices[i + 0]
      const vB = indices[i + 1]
      const vC = indices[i + 2]

      pA.fromArray(positions, vA * 3)
      pB.fromArray(positions, vB * 3)
      pC.fromArray(positions, vC * 3)

      cb.subVectors(pC, pB)
      ab.subVectors(pA, pB)
      cb.cross(ab)

      normals[vA * 3] += cb.x
      normals[vA * 3 + 1] += cb.y
      normals[vA * 3 + 2] += cb.z

      normals[vB * 3] += cb.x
      normals[vB * 3 + 1] += cb.y
      normals[vB * 3 + 2] += cb.z

      normals[vC * 3] += cb.x
      normals[vC * 3 + 1] += cb.y
      normals[vC * 3 + 2] += cb.z
    }

    this.normalizeNormals()
    this.attributes.normal = normalAttribute
  }

  private normalizeNormals(): void {
    const normals = this.attributes.normal.array
    const tempNormal = new Vector3()

    for (let i = 0, il = this.attributes.normal.count; i < il; i++) {
      tempNormal.fromArray(normals, i * 3)
      tempNormal.normalize()
      normals[i * 3 + 0] = tempNormal.x
      normals[i * 3 + 1] = tempNormal.y
      normals[i * 3 + 2] = tempNormal.z
    }
  }
}
