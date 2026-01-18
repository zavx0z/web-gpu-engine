/**
 * @packageDocumentation
 * @module GLTFLoader
 *
 * Модуль для загрузки и парсинга 3D-моделей в формате glTF 2.0.
 *
 * **Архитектура**
 * - **GLTFLoader**: Основной класс, управляющий процессом загрузки.
 * - **Асинхронная загрузка**: Сначала загружается JSON-описание, затем параллельно подгружаются все необходимые бинарные буферы (`.bin`).
 * - **Рекурсивный парсинг**: Сцена строится путем рекурсивного обхода графа узлов (`nodes`) из glTF.
 * - **Преобразование координат**: Загрузчик может автоматически применять трансформацию для преобразования системы координат glTF (Y-up) в систему координат движка (Z-up). Это поведение управляется флагом.
 * - **Ограниченная поддержка материалов**: В текущей реализации парсер материалов создает `MeshLambertMaterial`, используя только `baseColorFactor`.
 */

import { Object3D } from "../core/Object3D"
import { Scene } from "../scenes/Scene"
import { Vector3 } from "../math/Vector3"
import { Mesh } from "../core/Mesh"
import { BufferAttribute, BufferGeometry } from "../core/BufferGeometry"
import { MeshLambertMaterial } from "../materials/MeshLambertMaterial"
import { Color } from "../math/Color"

// --- GLTF SPECIFICATION INTERFACES ---
// Эти интерфейсы отражают структуру JSON-файла glTF 2.0, обеспечивая строгую типизацию.

/** Корневой объект, описывающий весь glTF ассет. */
interface GLTF {
  scenes?: GLTFScene[]
  /** Индекс сцены, которая должна отображаться по умолчанию. */
  scene?: number
  nodes?: GLTFNode[]
  meshes?: GLTFMesh[]
  buffers?: GLTFBuffer[]
  bufferViews?: GLTFBufferView[]
  accessors?: GLTFAccessor[]
  materials?: GLTFMaterial[]
}

/** Описывает сцену как набор корневых узлов. */
interface GLTFScene {
  /** Массив индексов корневых узлов, принадлежащих этой сцене. */
  nodes: number[]
}

/**
 * Узел в иерархии графа сцены. Может содержать трансформацию и/или ссылки на другие сущности (меш, камера и т.д.).
 * Трансформация может быть задана либо матрицей 4x4, либо набором TRS (translation, rotation, scale).
 */
interface GLTFNode {
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: [number, number, number]
  /** Вращение в виде кватерниона [x, y, z, w]. */
  rotation?: [number, number, number, number]
  scale?: [number, number, number]
}

/** Описывает 3D-объект, состоящий из одного или нескольких геометрических примитивов. */
interface GLTFMesh {
  /** Массив примитивов, из которых состоит меш. Каждый примитив может иметь свой материал. */
  primitives: GLTFPrimitive[]
}

/**
 * Геометрический примитив, содержащий информацию для рендеринга.
 * Это фактическая геометрия, которая будет отрисована с использованием указанного материала.
 */
interface GLTFPrimitive {
  /** Словарь, где ключ - это семантика атрибута (e.g., 'POSITION', 'NORMAL'), а значение - индекс accessor'а. */
  attributes: { [key: string]: number }
  /** Индекс accessor'а, указывающего на данные индексов вершин. */
  indices?: number
  /** Индекс материала, который следует использовать для этого примитива. */
  material?: number
}

/** Ссылка на бинарный файл (.bin) и его размер. */
interface GLTFBuffer {
  /** URI бинарного файла. Может быть относительным путем или Data URI. */
  uri: string
  /** Длина буфера в байтах. */
  byteLength: number
}

/**
 * "Срез" (view) в бинарном буфере. Определяет непрерывный участок данных внутри `GLTFBuffer`.
 * Не несет информации о типе данных, только о их расположении.
 */
interface GLTFBufferView {
  /** Индекс буфера, к которому относится этот view. */
  buffer: number
  /** Смещение от начала буфера в байтах. */
  byteOffset?: number
  /** Длина этого среза в байтах. */
  byteLength: number
  /**
   * Цель, для которой предназначен буфер (e.g., 34962 для ARRAY_BUFFER, 34963 для ELEMENT_ARRAY_BUFFER).
   * Используется для оптимизации в WebGL, но в данном загрузчике не применяется.
   */
  target?: number
}

/**
 * "Accessor" - это финальный уровень абстракции, который описывает, как интерпретировать данные из `GLTFBufferView`.
 * Он определяет тип данных, их структуру (скаляр, вектор, матрица) и количество.
 */
interface GLTFAccessor {
  bufferView?: number
  byteOffset?: number
  /**
   * Тип компонента данных. Соответствует константам WebGL.
   * @example 5126 -> FLOAT, 5123 -> UNSIGNED_SHORT
   * @see {@link GLTFLoader.getTypedArray}
   */
  componentType: number
  /** Количество элементов (например, количество вершин или индексов). */
  count: number
  /**
   * Тип данных в accessor'е.
   * @example 'VEC3', 'SCALAR', 'MAT4'
   * @see {@link GLTFLoader.getItemSize}
   */
  type: string
}

/** Описание материала. glTF 2.0 использует PBR (Physically-Based Rendering) модель. */
interface GLTFMaterial {
  pbrMetallicRoughness?: {
    /** Базовый цвет и альфа-канал материала в виде массива [r, g, b, a]. */
    baseColorFactor?: [number, number, number, number]
  }
}

/** Опции для загрузчика glTF. */
interface GLTFLoaderOptions {
  /**
   * Если `true`, автоматически преобразует систему координат модели из Y-up (стандарт glTF) в Z-up.
   * @default true
   */
  convertToZUp?: boolean
}

/**
 * Загрузчик для файлов формата glTF 2.0.
 *
 * **Внутренняя логика**
 * 1. Загружает JSON-файл.
 * 2. Асинхронно загружает все связанные бинарные буферы.
 * 3. Парсит материалы (с ограничениями).
 * 4. Рекурсивно строит граф сцены из узлов (nodes).
 * 5. Для каждого узла с мешем парсит геометрию, извлекая данные из буферов через `accessors` и `bufferViews`.
 * 6. Опционально корректирует ориентацию модели из Y-up в Z-up.
 */
export class GLTFLoader {
  /**
   * Асинхронно загружает и парсит glTF файл, создавая из него сцену.
   *
   * @param url - Путь к файлу `.gltf`.
   * @param options - Опции загрузки.
   * @returns Promise, который разрешается с объектом, содержащим готовую для рендеринга {@link Scene}.
   * @throws Если не удается загрузить файл или его бинарные зависимости.
   *
   * @example
   * ```ts
   * const loader = new GLTFLoader();
   * // Загрузка с преобразованием осей (по умолчанию)
   * const { scene } = await loader.load('./models/MyModel.gltf');
   *
   * // Загрузка без преобразования осей
   * const { scene: rawScene } = await loader.load('./models/MyModel.gltf', { convertToZUp: false });
   *
   * renderer.render(scene, camera);
   * ```
   */
  public async load(url: string, options?: GLTFLoaderOptions): Promise<{ scene: Scene }> {
    const { convertToZUp = true } = options ?? {}

    const response = await fetch(url)
    const gltf = (await response.json()) as GLTF

    const baseUri = url.substring(0, url.lastIndexOf("/") + 1)

    const buffers = await this.loadBuffers(gltf, baseUri)
    const materials = this.parseMaterials(gltf)

    const scene = new Scene()
    let parentNode: Object3D = scene

    // Если флаг convertToZUp установлен, создаем узел-обертку для преобразования координат.
    if (convertToZUp) {
      const modelWrapper = new Object3D()
      // Поворот на 90 градусов по оси X преобразует систему Y-up в Z-up.
      modelWrapper.rotation = new Vector3(Math.PI / 2, 0, 0)
      modelWrapper.updateMatrix()
      scene.add(modelWrapper)
      parentNode = modelWrapper
    }

    if (gltf.scene !== undefined && gltf.scenes) {
      const sceneDef = gltf.scenes[gltf.scene]
      for (const nodeIndex of sceneDef.nodes) {
        const node = this.parseNode(gltf, nodeIndex, buffers, materials)
        if (node) {
          // Добавляем узел либо в сцену напрямую, либо в узел-обертку.
          parentNode.add(node)
        }
      }
    }

    return { scene }
  }

  /**
   * Загружает все бинарные буферы, перечисленные в glTF.
   * @throws Если размер загруженного буфера не совпадает с `byteLength` из спецификации.
   */
  private async loadBuffers(gltf: GLTF, baseUri: string): Promise<ArrayBuffer[]> {
    const promises: Promise<ArrayBuffer>[] = []
    if (gltf.buffers) {
      for (const bufferInfo of gltf.buffers) {
        promises.push(
          fetch(baseUri + bufferInfo.uri)
            .then((res) => res.arrayBuffer())
            .then((arrayBuffer) => {
              if (arrayBuffer.byteLength < bufferInfo.byteLength) {
                throw new Error("glTF buffer length mismatch: loaded data is smaller than specified.")
              }
              return arrayBuffer
            })
        )
      }
    }
    return Promise.all(promises)
  }

  /**
   * Парсит материалы из glTF.
   * **Ограничение:** В текущей реализации создается `MeshLambertMaterial` и используется только `baseColorFactor`.
   * PBR-свойства, такие как metallic/roughness и текстуры, игнорируются.
   */
  private parseMaterials(gltf: GLTF): MeshLambertMaterial[] {
    const materials: MeshLambertMaterial[] = []
    if (gltf.materials) {
      for (const mat of gltf.materials) {
        let color
        if (mat.pbrMetallicRoughness?.baseColorFactor) {
          const [r, g, b] = mat.pbrMetallicRoughness.baseColorFactor
          color = new Color(r, g, b)
        }
        materials.push(new MeshLambertMaterial({ color }))
      }
    }
    return materials
  }

  /**
   * Рекурсивно парсит узел сцены (node) и всех его потомков.
   * Применяет трансформации и создает меши.
   */
  private parseNode(
    gltf: GLTF,
    nodeIndex: number,
    buffers: ArrayBuffer[],
    materials: MeshLambertMaterial[]
  ): Object3D | null {
    const nodeDef = gltf.nodes![nodeIndex]
    const node = new Object3D()

    if (nodeDef.matrix) {
      node.modelMatrix.elements.set(nodeDef.matrix)
    } else {
      if (nodeDef.translation) {
        node.position.x = nodeDef.translation[0]
        node.position.y = nodeDef.translation[1]
        node.position.z = nodeDef.translation[2]
      }
      if (nodeDef.rotation) {
        node.quaternion.x = nodeDef.rotation[0]
        node.quaternion.y = nodeDef.rotation[1]
        node.quaternion.z = nodeDef.rotation[2]
        node.quaternion.w = nodeDef.rotation[3]
      }
      if (nodeDef.scale) {
        node.scale.x = nodeDef.scale[0]
        node.scale.y = nodeDef.scale[1]
        node.scale.z = nodeDef.scale[2]
      }
      node.updateMatrix()
    }

    if (nodeDef.mesh !== undefined) {
      const meshDef = gltf.meshes![nodeDef.mesh]
      for (const primitive of meshDef.primitives) {
        const geometry = this.parseGeometry(gltf, primitive, buffers)
        const material = primitive.material !== undefined ? materials[primitive.material] : new MeshLambertMaterial()
        const mesh = new Mesh(geometry, material)
        node.add(mesh)
      }
    }

    if (nodeDef.children) {
      for (const childIndex of nodeDef.children) {
        const childNode = this.parseNode(gltf, childIndex, buffers, materials)
        if (childNode) {
          node.add(childNode)
        }
      }
    }

    return node
  }

  /**
   * Парсит геометрию примитива, извлекая вершинные данные из буферов.
   *
   * **Внутренняя логика**
   * 1. Итерирует по атрибутам (`POSITION`, `NORMAL`, etc.).
   * 2. Находит соответствующий `accessor`, затем `bufferView` для получения смещения и длины.
   * 3. Создает типизированный массив (`TypedArray`) нужного типа и размера, который является "окном" в большой бинарный буфер.
   * 4. Создает `BufferAttribute` и устанавливает его для геометрии.
   * 5. Если нормали не предоставлены, но есть индексы, пытается вычислить их автоматически.
   */
  private parseGeometry(gltf: GLTF, primitive: GLTFPrimitive, buffers: ArrayBuffer[]): BufferGeometry {
    const geometry = new BufferGeometry()

    for (const [attributeName, accessorIndex] of Object.entries(primitive.attributes)) {
      if (attributeName === "POSITION" || attributeName === "NORMAL") {
        const accessor = gltf.accessors![accessorIndex]
        const bufferView = gltf.bufferViews![accessor.bufferView!]
        const buffer = buffers[bufferView.buffer]
        const componentType = accessor.componentType
        const type = accessor.type
        const count = accessor.count

        const TypedArray = this.getTypedArray(componentType)
        const itemSize = this.getItemSize(type)

        const array = new TypedArray(
          buffer,
          (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
          count * itemSize
        )

        const attributeNameLower = attributeName.toLowerCase() as "position" | "normal"
        geometry.setAttribute(attributeNameLower, new BufferAttribute(array, itemSize))
      }
    }

    if (primitive.indices !== undefined) {
      const accessor = gltf.accessors![primitive.indices]
      const bufferView = gltf.bufferViews![accessor.bufferView!]
      const buffer = buffers[bufferView.buffer]
      const componentType = accessor.componentType
      const count = accessor.count

      const TypedArray = this.getTypedArray(componentType)
      const array = new TypedArray(buffer, (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0), count)

      geometry.setIndex(new BufferAttribute(array, 1))
    }

    if (!geometry.attributes.normal && geometry.index) {
      geometry.computeVertexNormals()
    }

    return geometry
  }

  /**
   * Возвращает конструктор TypedArray на основе числового кода из спецификации glTF.
   * @param componentType - Числовой код типа компонента (e.g., 5126 для FLOAT).
   */
  private getTypedArray(componentType: number): any {
    switch (componentType) {
      case 5120: // BYTE
        return Int8Array
      case 5121: // UNSIGNED_BYTE
        return Uint8Array
      case 5122: // SHORT
        return Int16Array
      case 5123: // UNSIGNED_SHORT
        return Uint16Array
      case 5125: // UNSIGNED_INT
        return Uint32Array
      case 5126: // FLOAT
        return Float32Array
      default:
        throw new Error(`Unsupported componentType: ${componentType}`)
    }
  }

  /**
   * Возвращает количество компонентов для типа данных из спецификации glTF.
   * @param type - Строковый тип данных (e.g., "VEC3").
   */
  private getItemSize(type: string): number {
    switch (type) {
      case "SCALAR":
        return 1
      case "VEC2":
        return 2
      case "VEC3":
        return 3
      case "VEC4":
        return 4
      case "MAT2":
        return 4
      case "MAT3":
        return 9
      case "MAT4":
        return 16
      default:
        throw new Error(`Unsupported type: ${type}`)
    }
  }
}
