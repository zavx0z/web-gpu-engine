export type ColorSource = Color | number | string

/**
 * Класс для работы с цветами.
 * @see https://threejs.org/docs/#api/en/math/Color
 */
export class Color {
	/**
	 * Красный компонент цвета.
	 * @default 1
	 */
	public r: number = 1
	/**
	 * Зеленый компонент цвета.
	 * @default 1
	 */
	public g: number = 1
	/**
	 * Синий компонент цвета.
	 * @default 1
	 */
	public b: number = 1

	/**
	 * @param r Значение красного компонента, или шестнадцатеричное значение, или строка.
	 * @param g Значение зеленого компонента.
	 * @param b Значение синего компонента.
	 */
	constructor(r?: ColorSource, g?: number, b?: number) {
		if (g === undefined && b === undefined) {
			this.set(r ?? 0xffffff)
		} else {
			this.setRGB(r as number, g as number, b as number)
		}
	}

	/**
	 * Устанавливает значения RGB.
	 * @param r Значение красного компонента.
	 * @param g Значение зеленого компонента.
	 * @param b Значение синего компонента.
	 * @returns Текущий экземпляр Color.
	 */
	public setRGB(r: number, g: number, b: number): this {
		this.r = r
		this.g = g
		this.b = b
		return this
	}

	/**
	 * Устанавливает цвет из различных источников.
	 * @param value Значение цвета.
	 * @returns Текущий экземпляр Color.
	 */
	public set(value: ColorSource): this {
		if (value instanceof Color) {
			this.copy(value)
		} else if (typeof value === "number") {
			this.setHex(value)
		} else if (typeof value === "string") {
			this.setStyle(value)
		}
		return this
	}

	/**
	 * Копирует значения из другого цвета.
	 * @param color Цвет для копирования.
	 * @returns Текущий экземпляр Color.
	 */
	public copy(color: Color): this {
		this.r = color.r
		this.g = color.g
		this.b = color.b
		return this
	}

	/**
	 * Устанавливает цвет из шестнадцатеричного значения.
	 * @param hex Шестнадцатеричное значение.
	 * @returns Текущий экземпляр Color.
	 */
	public setHex(hex: number): this {
		hex = Math.floor(hex)
		this.r = ((hex >> 16) & 255) / 255
		this.g = ((hex >> 8) & 255) / 255
		this.b = (hex & 255) / 255
		return this
	}

	/**
	 * Устанавливает цвет из строки CSS-стиля.
	 * @param style Строка CSS-стиля.
	 * @returns Текущий экземпляр Color.
	 */
	public setStyle(style: string): this {
		// TODO: Implement style parsing
		return this
	}
}
