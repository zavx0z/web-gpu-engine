/**
 * Параметры для конструктора Material.
 */
export interface MaterialParameters {
	/**
	 * Определяет, является ли этот материал прозрачным.
	 * @default false
	 */
	transparent?: boolean
}

/**
 * Абстрактный базовый класс для материалов.
 * @see https://threejs.org/docs/#api/en/materials/Material
 */
export abstract class Material {
	/**
	 * Указывает, что данный объект является материалом.
	 */
	public readonly isMaterial: true = true

	public abstract type: string

	/**
	 * Прозрачность материала.
	 */
	public transparent: boolean

	constructor(parameters: MaterialParameters = {}) {
		this.transparent = parameters.transparent ?? false
	}
}
