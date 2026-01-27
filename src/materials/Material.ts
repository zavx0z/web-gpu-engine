/**
 * Параметры для создания {@link Material}.
 */
export interface MaterialParameters {
  /**
   * Определяет, видим ли материал.
   * @default true
   */
  visible?: boolean
  /**
   * Определяет, должны ли использоваться цвета вершин.
   * @default false
   */
  vertexColors?: boolean

  /**
   * Определяет, является ли материал прозрачным.
   * @default false
   */
  transparent?: boolean
}

/**
 * Абстрактный базовый класс для материалов.
 */
export abstract class Material {
  /**
   * Определяет, видим ли материал. Если установлено в `false`, объекты с этим материалом не будут отрисовываться.
   * @default true
   */
  public visible: boolean
  /**
   * Определяет, должны ли использоваться цвета вершин.
   * @default false
   */
  public vertexColors: boolean

  /**
   * Определяет, является ли материал прозрачным. Влияет на смешивание цветов.
   * @default false
   */
  public transparent: boolean

  /**
   * Флаг для идентификации стеклянных материалов.
   * @default false
   */
  public readonly isGlassMaterial: boolean = false

  /**
   * @param parameters Параметры материала.
   */
  constructor(parameters: MaterialParameters = {}) {
    this.visible = parameters.visible ?? true
    this.vertexColors = parameters.vertexColors ?? false
    this.transparent = parameters.transparent ?? false
  }
}
