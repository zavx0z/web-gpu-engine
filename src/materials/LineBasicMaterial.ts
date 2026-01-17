import { Color } from "../math/Color"
import { Material, MaterialParameters } from "./Material"

/**
 * Параметры для создания {@link LineBasicMaterial}.
 */
export interface LineBasicMaterialParameters extends MaterialParameters {
  /**
   * Цвет линии в формате RGB.
   * @default 0xffffff
   */
  color?: number
}

/**
 * Базовый материал для отрисовки линий.
 */
export class LineBasicMaterial extends Material {
  public color: Color

  /**
   * @param parameters - Параметры материала.
   */
  constructor(parameters: LineBasicMaterialParameters = {}) {
    super(parameters)
    this.color = new Color(parameters.color ?? 0xffffff)
  }
}
