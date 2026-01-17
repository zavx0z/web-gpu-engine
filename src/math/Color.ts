/**
 * Класс для представления цвета в формате RGB.
 */
export class Color {
  /**
   * @min 0
   * @max 1
   */
  public r: number = 1.0

  /**
   * @min 0
   * @max 1
   */
  public g: number = 1.0

  /**
   * @min 0
   * @max 1
   */
  public b: number = 1.0

  /**
   * Создает экземпляр Color.
   * @param r - Значение красного (0-1), шестнадцатеричное значение, или другой экземпляр Color.
   * @param g - Значение зеленого (0-1).
   * @param b - Значение синего (0-1).
   */
  constructor(r?: number | Color, g?: number, b?: number) {
    if (r instanceof Color) {
      this.copy(r)
    } else if (g === undefined && b === undefined) {
      this.setHex(r ?? 0xffffff)
    } else {
      this.setRGB(r as number, g!, b!)
    }
  }

  /**
   * Копирует значения из другого объекта Color.
   * @param color - Объект Color, из которого копируются значения.
   * @returns Возвращает этот экземпляр для чейнинга.
   */
  public copy(color: Color): this {
    this.r = color.r
    this.g = color.g
    this.b = color.b
    return this
  }

  /**
   * Клонирует данный объект Color.
   * @returns Новый объект Color.
   */
  public clone(): Color {
    return new Color(this.r, this.g, this.b)
  }

  /**
   * Устанавливает цвет из RGB компонентов.
   * @param r - Красный компонент (0-1).
   * @param g - Зеленый компонент (0-1).
   * @param b - Синий компонент (0-1).
   * @returns Возвращает этот экземпляр для чейнинга.
   */
  public setRGB(r: number, g: number, b: number): this {
    this.r = r
    this.g = g
    this.b = b
    return this
  }

  /**
   * Устанавливает цвет из шестнадцатеричного значения.
   * @param hex - Шестнадцатеричное значение цвета (например, 0xff0000 для красного).
   * @returns Возвращает этот экземпляр для чейнинга.
   */
  public setHex(hex: number): this {
    hex = Math.floor(hex)
    this.r = ((hex >> 16) & 255) / 255
    this.g = ((hex >> 8) & 255) / 255
    this.b = (hex & 255) / 255
    return this
  }

  /**
   * Возвращает массив [r, g, b, 1.0] (RGBA) в виде Float32Array.
   * @returns Массив со значениями цвета.
   */
  public toArray(): Float32Array {
    return new Float32Array([this.r, this.g, this.b, 1.0])
  }
}
