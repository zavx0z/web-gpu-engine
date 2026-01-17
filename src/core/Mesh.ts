import { Object3D } from "./Object3D"
import { BufferGeometry } from "./BufferGeometry"
import { Material } from "../materials/Material"

/**
 * Базовый объект сцены, представляющий 3D-модель.
 *
 * ## Ответственность
 * Связывает математическое описание формы {@link BufferGeometry}
 * с визуальным стилем {@link Material}.
 *
 * ## Особенности рендеринга
 * * Если передан массив материалов, он сопоставляется с `geometry.groups`.
 * * Автоматически обновляет нормали, если они не заданы в геометрии.
 *
 * @example
 * ```ts
 * const geometry = new TorusGeometry();
 * const material = new MeshBasicMaterial({ color: 0xff0000 });
 * const torus = new Mesh(geometry, material);
 * scene.add(torus);
 * ```
 */
export class Mesh extends Object3D {
  /**
   * Структура вершин (позиции, нормали, UV).
   */
  public geometry: BufferGeometry

  /**
   * Визуальное описание поверхности.
   * При использовании массива материалов, индексы соответствуют `geometry.groups[i].materialIndex`.
   */
  public material: Material | Material[]

  /**
   * Инициализирует новый 3D-объект.
   *
   * @param geometry - Экземпляр геометрии. Передается по ссылке (не клонируется).
   * @param material - Одиночный материал или массив.
   * **Важно:** При передаче массива убедитесь, что геометрия разбита на группы.
   */
  constructor(geometry: BufferGeometry, material: Material | Material[]) {
    super()
    this.geometry = geometry
    this.material = material
  }
}
