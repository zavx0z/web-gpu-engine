import { Vector3 } from "../math/Vector3"

/**
 * Типы TypedArray, которые можно использовать в BufferAttribute.
 */
export type TypedArray = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int32Array | Int16Array | Int8Array

/**
 * Хранит сырые данные для одного атрибута геометрии.
 * Обеспечивает связь между JS-массивами и буферами GPU.
 */
export class BufferAttribute {
  /**
   * Прямая ссылка на типизированный массив данных.
   * Изменение значений здесь требует установки флага обновления (в будущих версиях).
   */
  public array: TypedArray

  /**
   * Количество компонентов на одну вершину (stride).
   * Обычно: 3 (XYZ), 2 (UV), 4 (Tangent/Color).
   */
  public itemSize: number

  /**
   * Общее число вершин в атрибуте (read-only derived).
   */
  public count: number

  /**
   * @param array - Данные. Передаются по ссылке (не клонируются).
   * @param itemSize - Компонентность. Ограничение: `[1..4]`.
   */
  constructor(array: TypedArray, itemSize: number) {
    this.array = array
    this.itemSize = itemSize
    this.count = array.length / itemSize
  }
}

/**
 * Геометрическое описание 3D-объекта.
 * Хранит словарь атрибутов и топологию (индексы).
 */
export class BufferGeometry {
  /**
   * Словарь активных атрибутов.
   * Ключи соответствуют именам переменных в шейдере (`position`, `normal`, `uv`, `instanceMatrix`).
   */
  public attributes: { [name: string]: BufferAttribute } = {}

  /**
   * Индексный буфер, определяющий порядок вершин в треугольниках.
   * Если `null`, используется отрисовка массивом (Non-indexed draw).
   */
  public index: BufferAttribute | null = null

  /**
   * Добавляет или обновляет атрибут.
   *
   * @param name - Семантическое имя (напр. `'position'`, `'uv'`).
   * @param attribute - Данные атрибута.
   * @returns Ссылка на себя для чейнинга.
   */
  public setAttribute(name: string, attribute: BufferAttribute): this {
    this.attributes[name] = attribute
    return this
  }

  /**
   * Устанавливает топологию сетки.
   *
   * @param index - Буфер индексов (обычно Uint16 или Uint32).
   */
  public setIndex(index: BufferAttribute): this {
    this.index = index
    return this
  }

  /**
   * Генерирует нормали вершин на основе геометрии.
   *
   * ## Алгоритм (Area Weighted)
   * Нормаль вершины вычисляется как сумма нормалей прилегающих граней.
   * Вклад каждой грани **пропорционален её площади**.
   * Это обеспечивает корректное сглаживание для неравномерных сеток.
   *
   * ## Требования
   * * Геометрия должна иметь атрибут `position`.
   * * Геометрия должна быть индексированной (`index != null`).
   *
   * @returns Создает и записывает новый атрибут `normal`.
   * При ошибке (нет позиций или индексов) выводит `console.error` и прерывает выполнение.
   */
  public computeVertexNormals(): void {
    const index = this.index
    const positionAttribute = this.attributes.position

    if (!positionAttribute) {
      console.error("BufferGeometry.computeVertexNormals(): отсутствует атрибут 'position'.")
      return
    }

    if (!index) {
      console.error("BufferGeometry.computeVertexNormals(): поддерживается только индексированная геометрия.")
      return
    }

    // Создаем новый буфер для нормалей (обнуленный)
    const normalAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3)

    const pA = new Vector3(),
      pB = new Vector3(),
      pC = new Vector3()
    const cb = new Vector3(),
      ab = new Vector3()

    const indices = index.array
    const positions = positionAttribute.array
    const normals = normalAttribute.array

    // Итерация по треугольникам
    for (let i = 0, il = index.count; i < il; i += 3) {
      const vA = indices[i + 0]
      const vB = indices[i + 1]
      const vC = indices[i + 2]

      pA.fromArray(positions, vA * 3)
      pB.fromArray(positions, vB * 3)
      pC.fromArray(positions, vC * 3)

      cb.subVectors(pC, pB)
      ab.subVectors(pA, pB)

      // Векторное произведение дает нормаль грани.
      // Длина этого вектора равна удвоенной площади треугольника.
      // Складывая их, мы автоматически получаем Area Weighted Average.
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

    this.normalizeNormals(normalAttribute)
    this.attributes.normal = normalAttribute
  }

  /**
   * Нормализует векторы в указанном атрибуте.
   * Используется как финальный шаг алгоритма Area Weighted Normals.
   */
  private normalizeNormals(attribute: BufferAttribute): void {
    const normals = attribute.array
    const tempNormal = new Vector3()

    for (let i = 0, il = attribute.count; i < il; i++) {
      tempNormal.fromArray(normals, i * 3)
      tempNormal.normalize()

      normals[i * 3 + 0] = tempNormal.x
      normals[i * 3 + 1] = tempNormal.y
      normals[i * 3 + 2] = tempNormal.z
    }
  }
}
