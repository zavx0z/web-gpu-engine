/**
 * @packageDocumentation
 * @module GLTFLoader
 * 
 * Модуль для загрузки и парсинга 3D-моделей в формате glTF 2.0.
 * Поддерживает как стандартный формат (`.gltf` + `.bin`), так и бинарный (`.glb`).
 * 
 * **Архитектура**
 * - **GLTFLoader**: Основной класс, управляющий процессом загрузки.
 * - **Универсальный метод `load`**: Автоматически определяет формат файла (JSON или бинарный) и вызывает соответствующий парсер.
 * - **Асинхронная загрузка**: Для `.gltf` сначала загружается JSON, затем параллельно подгружаются все необходимые бинарные буферы. Для `.glb` все загружается одним запросом.
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

// --- GLTF Constants ---
const GLB_MAGIC = 0x46546C67 // "glTF" в ASCII
const JSON_CHUNK_TYPE = 0x4E4F534A // "JSON" в ASCII
const BIN_CHUNK_TYPE = 0x004E4942 // "BIN\0" в ASCII

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
  uri?: string
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
 * Поддерживает как стандартный `.gltf` (JSON + бинарные файлы), так и бинарный `.glb` формат.
 */
export class GLTFLoader {
  /**
   * Асинхронно загружает и парсит glTF или GLB файл, создавая из него сцену.
   *
   * @param url - Путь к файлу `.gltf` или `.glb`.
   * @param options - Опции загрузки.
   * @returns Promise, который разрешается с объектом, содержащим готовую для рендеринга {@link Scene}.
   * @throws Если не удается загрузить файл, он имеет неверный формат или его зависимости не найдены.
   *
   * @example
   * ```ts
   * const loader = new GLTFLoader();
   * // Загрузка GLB с преобразованием осей (по умолчанию)
   * const { scene } = await loader.load('./models/MyModel.glb');
   * 
   * // Загрузка GLTF без преобразования осей
   * const { scene: rawScene } = await loader.load('./models/MyModel.gltf', { convertToZUp: false });
   * 
   * renderer.render(scene, camera);
   * ```
   */
  public async load(url: string, options?: GLTFLoaderOptions): Promise<{ scene: Scene }> {
    const { convertToZUp = true } = options ?? {}

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength < 4) {
      throw new Error(`File is too short or empty: ${url}`)
    }

    let gltf: GLTF
    let buffers: ArrayBuffer[]
    const dataView = new DataView(arrayBuffer)

    // Проверяем "магическое" число в заголовке, чтобы определить, является ли файл бинарным (GLB)
    if (dataView.getUint32(0, true) === GLB_MAGIC) {
      const glbResult = this.parseGLB(arrayBuffer)
      gltf = glbResult.gltf
      buffers = glbResult.buffers
    } else {
      // Если это не GLB, предполагаем, что это стандартный текстовый GLTF
      const textDecoder = new TextDecoder('utf-8')
      gltf = JSON.parse(textDecoder.decode(arrayBuffer)) as GLTF
      const baseUri = url.substring(0, url.lastIndexOf("/") + 1)
      buffers = await this.loadExternalBuffers(gltf, baseUri)
    }

    const materials = this.parseMaterials(gltf)
    const scene = new Scene()
    let parentNode: Object3D = scene

    if (convertToZUp) {
      const modelWrapper = new Object3D()
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
          parentNode.add(node)
        }
      }
    }

    return { scene }
  }

  /**
   * Парсит бинарный контейнер GLB, извлекая из него JSON-часть и бинарный чанк.
   * @param data - ArrayBuffer с содержимым .glb файла.
   * @returns Объект, содержащий распарсенный JSON (`gltf`) и массив с бинарным буфером (`buffers`).
   * @throws Если структура GLB некорректна.
   */
  private parseGLB(data: ArrayBuffer): { gltf: GLTF; buffers: ArrayBuffer[] } {
    const dataView = new DataView(data)
    const magic = dataView.getUint32(0, true)

    if (magic !== GLB_MAGIC) {
      throw new Error("Invalid GLB file: incorrect magic number.")
    }

    const version = dataView.getUint32(4, true)
    if (version !== 2) {
      throw new Error(`Unsupported GLB version: ${version}. Only version 2 is supported.`)
    }

    let jsonChunkData: ArrayBuffer | null = null
    let binChunkData: ArrayBuffer | null = null

    let chunkOffset = 12 // Пропускаем 12-байтный заголовок

    while (chunkOffset + 8 <= data.byteLength) {
      const chunkLength = dataView.getUint32(chunkOffset, true)
      const chunkType = dataView.getUint32(chunkOffset + 4, true)
      const chunkDataStart = chunkOffset + 8
      const chunkData = data.slice(chunkDataStart, chunkDataStart + chunkLength)

      if (chunkType === JSON_CHUNK_TYPE) {
        jsonChunkData = chunkData
      } else if (chunkType === BIN_CHUNK_TYPE) {
        binChunkData = chunkData
      }

      chunkOffset = chunkDataStart + chunkLength
    }

    if (!jsonChunkData) {
      throw new Error("Invalid GLB file: JSON chunk not found.")
    }

    const textDecoder = new TextDecoder('utf-8')
    const gltf = JSON.parse(textDecoder.decode(jsonChunkData)) as GLTF

    const buffers: ArrayBuffer[] = []
    if (binChunkData) {
      buffers.push(binChunkData)
    }

    return { gltf, buffers }
  }

  /**
   * Загружает все внешние бинарные буферы, перечисленные в `.gltf` файле.
   * @throws Если размер загруженного буфера не совпадает с `byteLength` из спецификации.
   */
  private async loadExternalBuffers(gltf: GLTF, baseUri: string): Promise<ArrayBuffer[]> {
    const promises: Promise<ArrayBuffer>[] = []
    if (gltf.buffers) {
      for (const bufferInfo of gltf.buffers) {
        if (!bufferInfo.uri) {
          throw new Error("Buffer URI is missing for external buffer.")
        }
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

        const attributeNameLower = attributeName.toLowerCase() as 'position' | 'normal';
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
