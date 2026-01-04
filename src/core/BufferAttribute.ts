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
	 * @param array Массив с данными.
	 * @param itemSize Размер одного элемента.
	 */
    constructor(array: any, itemSize: number) {
        this.array = array
        this.itemSize = itemSize
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
	 * @param array Массив чисел или Float32Array.
	 * @param itemSize Размер одного элемента.
	 */
    constructor(array: number[] | Float32Array, itemSize: number) {
        super(new Float32Array(array), itemSize)
    }
}
