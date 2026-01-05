/**
 * Абстрактный базовый класс для материалов.
 */
export abstract class Material {
	/**
	 * Определяет, видим ли материал. Если установлено в `false`, объекты с этим материалом не будут отрисовываться.
	 * @default true
	 */
	public visible: boolean = true
}
