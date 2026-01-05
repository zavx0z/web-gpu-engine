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
	 * @returns {this}
	 */
	public setAttribute(name: string, attribute: BufferAttribute): this {
		this.attributes[name] = attribute
		return this
	}

	/**
	 * Устанавливает индексный буфер для геометрии.
	 * @param index - Объект BufferAttribute с индексами.
	 * @returns {this}
	 */
	public setIndex(index: BufferAttribute): this {
		this.index = index
		return this
	}
}
