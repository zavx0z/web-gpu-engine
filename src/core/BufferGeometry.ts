import { BufferAttribute } from "./BufferAttribute"

/**
 * Описание геометрии на основе вершин.
 * @see https://threejs.org/docs/#api/en/core/BufferGeometry
 */
export class BufferGeometry {
    /**
	 * Указывает, что данный объект является BufferGeometry.
	 */
    public readonly isBufferGeometry: true = true

	/**
	 * Атрибуты геометрии (позиции, нормали, цвета и т.д.).
	 */
    public attributes: { [name: string]: BufferAttribute } = {}

	/**
	 * Индексный буфер для вершин.
	 */
    public index: BufferAttribute | null = null

	/**
	 * Устанавливает индексный буфер.
	 * @param index Массив индексов или BufferAttribute.
	 * @returns Текущий экземпляр BufferGeometry.
	 */
    public setIndex(index: number[] | BufferAttribute): this {
        if (Array.isArray(index)) {
            this.index = new BufferAttribute(new Uint16Array(index), 1)
        } else {
            this.index = index
        }
        return this
    }

	/**
	 * Устанавливает атрибут геометрии.
	 * @param name Имя атрибута (например, 'position', 'normal', 'color').
	 * @param attribute BufferAttribute.
	 * @returns Текущий экземпляр BufferGeometry.
	 */
    public setAttribute(name: string, attribute: BufferAttribute): this {
        this.attributes[name] = attribute
        return this
    }
}
