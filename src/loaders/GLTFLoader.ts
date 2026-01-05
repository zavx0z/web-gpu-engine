import { Object3D } from "../core/Object3D"
import { Scene } from "../scenes/Scene"
import { Mesh } from "../core/Mesh"
import { BufferAttribute, BufferGeometry } from "../core/BufferGeometry"
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial"
import { Color } from "../math/Color"

// Определение интерфейсов для структуры glTF
interface GLTF {
	scenes?: GLTFScene[]
	scene?: number
	nodes?: GLTFNode[]
	meshes?: GLTFMesh[]
	buffers?: GLTFBuffer[]
	bufferViews?: GLTFBufferView[]
	accessors?: GLTFAccessor[]
	materials?: GLTFMaterial[]
}

interface GLTFScene {
	nodes: number[]
}

interface GLTFNode {
	mesh?: number
	children?: number[]
	matrix?: number[]
	translation?: [number, number, number]
	rotation?: [number, number, number, number]
	scale?: [number, number, number]
}

interface GLTFMesh {
	primitives: GLTFPrimitive[]
}

interface GLTFPrimitive {
	attributes: { [key: string]: number }
	indices?: number
	material?: number
}

interface GLTFBuffer {
	uri: string
	byteLength: number
}

interface GLTFBufferView {
	buffer: number
	byteOffset?: number
	byteLength: number
	target?: number
}

interface GLTFAccessor {
	bufferView?: number
	byteOffset?: number
	componentType: number
	count: number
	type: string
}

interface GLTFMaterial {
	pbrMetallicRoughness?: {
		baseColorFactor?: [number, number, number, number]
	}
}

/**
 * Загрузчик для файлов формата glTF.
 */
export class GLTFLoader {
	/**
	 * Загружает и парсит glTF файл.
	 * @param url - Путь к glTF файлу.
	 * @returns Promise, который разрешается со сценой, созданной из glTF.
	 */
	public async load(url: string): Promise<{ scene: Scene }> {
		const response = await fetch(url)
		const gltf = (await response.json()) as GLTF

		const baseUri = url.substring(0, url.lastIndexOf("/") + 1)

		const buffers = await this.loadBuffers(gltf, baseUri)
		const materials = this.parseMaterials(gltf)

		const scene = new Scene()
		if (gltf.scene !== undefined && gltf.scenes) {
			const sceneDef = gltf.scenes[gltf.scene]
			for (const nodeIndex of sceneDef.nodes) {
				const node = this.parseNode(gltf, nodeIndex, buffers, materials)
				if (node) {
					scene.add(node)
				}
			}
		}

		return { scene }
	}

	private async loadBuffers(gltf: GLTF, baseUri: string): Promise<ArrayBuffer[]> {
		const promises: Promise<ArrayBuffer>[] = []
		if (gltf.buffers) {
			for (const bufferInfo of gltf.buffers) {
				promises.push(
					fetch(baseUri + bufferInfo.uri)
						.then((res) => res.arrayBuffer())
						.then((arrayBuffer) => {
							if (arrayBuffer.byteLength < bufferInfo.byteLength) {
								throw new Error("Длина загруженного буфера меньше, чем указано в glTF.")
							}
							return arrayBuffer
						})
				)
			}
		}
		return Promise.all(promises)
	}

	private parseMaterials(gltf: GLTF): MeshBasicMaterial[] {
		const materials: MeshBasicMaterial[] = []
		if (gltf.materials) {
			for (const mat of gltf.materials) {
				let color
				if (mat.pbrMetallicRoughness?.baseColorFactor) {
					const [r, g, b] = mat.pbrMetallicRoughness.baseColorFactor
					color = new Color(r, g, b)
				}
				materials.push(new MeshBasicMaterial({ color }))
			}
		}
		return materials
	}

	private parseNode(
		gltf: GLTF,
		nodeIndex: number,
		buffers: ArrayBuffer[],
		materials: MeshBasicMaterial[]
	): Object3D | null {
		const nodeDef = gltf.nodes![nodeIndex]
		const node = new Object3D()

		// Установка трансформации
		if (nodeDef.matrix) {
			node.modelMatrix.elements = nodeDef.matrix
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
			node.updateMatrix() // Собираем матрицу из позиции, вращения и масштаба
		}

		if (nodeDef.mesh !== undefined) {
			const meshDef = gltf.meshes![nodeDef.mesh]
			for (const primitive of meshDef.primitives) {
				const geometry = this.parseGeometry(gltf, primitive, buffers)
				const material = primitive.material !== undefined ? materials[primitive.material] : new MeshBasicMaterial()
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

	private parseGeometry(gltf: GLTF, primitive: GLTFPrimitive, buffers: ArrayBuffer[]): BufferGeometry {
		const geometry = new BufferGeometry()
		for (const [attributeName, accessorIndex] of Object.entries(primitive.attributes)) {
			if (attributeName === "POSITION") {
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
				geometry.setAttribute("position", new BufferAttribute(array, itemSize))
			}
		}

		if (primitive.indices !== undefined) {
			const accessor = gltf.accessors![primitive.indices]
			const bufferView = gltf.bufferViews![accessor.bufferView!]
			const buffer = buffers[bufferView.buffer]
			const componentType = accessor.componentType
			const count = accessor.count

			const TypedArray = this.getTypedArray(componentType)
			const array = new TypedArray(
				buffer,
				(bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
				count
			)
			geometry.setIndex(new BufferAttribute(array, 1))
		}
		return geometry
	}

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
