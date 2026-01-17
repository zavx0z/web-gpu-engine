/**
 * Хранит данные для атрибута BufferGeometry.
 * @see https://threejs.org/docs/#api/en/core/BufferAttribute
 */
export class BufferAttribute {
  /**
   * Указывает, что данный объект является BufferAttribute.
   */
  public readonly isBufferAttribute: true = true
  /**
   * Массив с данными.
   */
  public array: any
  /**
   * Размер одного элемента (например, 3 для векторов).
   */
  public itemSize: number
  /**
   * Указывает, должны ли данные быть нормализованы (между 0 и 1 для целых чисел со знаком, или -1 и 1 для целых без знака).
   * @default false
   */
  public normalized: boolean

  /**
   * @param array - Массив с данными.
   * @param itemSize - Размер одного элемента (например, 3 для векторов).
   * @param normalized - Указывает, должны ли данные быть нормализованы.
   * @default false
   */
  constructor(array: any, itemSize: number, normalized = false) {
    this.array = array
    this.itemSize = itemSize
    this.normalized = normalized
  }

  /**
   * Количество элементов в буфере.
   */
  get count(): number {
    return this.array.length / this.itemSize
  }
}

/**
 * BufferAttribute для данных в формате Float32.
 */
export class Float32BufferAttribute extends BufferAttribute {
  /**
   * @param array - Массив чисел или Float32Array.
   * @param itemSize - Размер одного элемента.
   * @param normalized - Указывает, должны ли данные быть нормализованы.
   * @default false
   */
  constructor(array: number[] | Float32Array, itemSize: number, normalized = false) {
    super(new Float32Array(array), itemSize, normalized)
  }
}
