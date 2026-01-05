import { BufferAttribute } from "../core/BufferAttribute"
import { BufferGeometry } from "../core/BufferGeometry"
import { BasicMaterial } from "../materials/BasicMaterial"
import { Mesh } from "../core/Mesh"
import { Object3D } from "../core/Object3D"
import { Scene } from "../scenes/Scene"
import { quat, vec3 } from "gl-matrix"

// #region glTF Interfaces
/**
 * Спецификация glTF 2.0: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
 */

interface GLTF {
	asset: GLTFAsset
	scenes?: GLTFScene[]
	scene?: number
	nodes?: GLTFNode[]
	meshes?: GLTFMesh[]
	buffers?: GLTFBuffer[]
	bufferViews?: GLTFBufferView[]
	accessors?: GLTFAccessor[]
	materials?: GLTFMaterial[]
}

interface GLTFAsset {
	version: string
	generator?: string
	copyright?: string
}

interface GLTFScene {
	name?: string
	nodes?: number[]
}

interface GLTFNode {
	name?: string
	mesh?: number
	camera?: number
	children?: number[]
	matrix?: number[]
	translation?: [number, number, number]
	rotation?: [number, number, number, number]
	scale?: [number, number, number]
}

interface GLTFMesh {
	name?: string
	primitives: GLTFPrimitive[]
}

interface GLTFPrimitive {
	attributes: { [key: string]: number }
	indices?: number
	material?: number
	mode?: number
}

interface GLTFBuffer {
	uri?: string
	byteLength: number
}

interface GLTFBufferView {
	buffer: number
	byteOffset?: number
	byteLength: number
	byteStride?: number
}

interface GLTFAccessor {
	bufferView?: number
	byteOffset?: number
	componentType: number
	normalized?: boolean
	count: number
	type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4"
	max?: number[]
	min?: number[]
}

interface GLTFMaterial {
	name?: string
	pbrMetallicRoughness?: GLTFPBRMetallicRoughness
}

interface GLTFPBRMetallicRoughness {
	baseColorFactor?: [number, number, number, number]
	metallicFactor?: number
	roughnessFactor?: number
}
// #endregion

// #region glTF Constants
type ComponentTypeMap = {
	5120: Int8ArrayConstructor
	5121: Uint8ArrayConstructor
	5122: Int16ArrayConstructor
	5123: Uint16ArrayConstructor
	5125: Uint32ArrayConstructor
	5126: Float32ArrayConstructor
}

const COMPONENT_TYPE_MAP: ComponentTypeMap = {
	5120: Int8Array,
	5121: Uint8Array,
	5122: Int16Array,
	5123: Uint16Array,
	5125: Uint32Array,
	5126: Float32Array,
}

const TYPE_COMPONENT_COUNT = {
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT2: 4,
	MAT3: 9,
	MAT4: 16,
}
// #endregion

/**
 * Загрузчик для файлов формата glTF 2.0.
 */
export class GLTFLoader {
	/**
	 * Загружает и парсит glTF файл, возвращая сцену.
	 * @param url URL glTF (.gltf) файла.
	 * @returns Promise, который разрешается с объектом, содержащим сцену.
	 */
	public async load(url: string): Promise<{ scene: Scene }> {
		const parentUrl = url.substring(0, url.lastIndexOf("/") + 1)
		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`Не удалось загрузить файл: ${response.statusText}`)
		}

		const gltf = (await response.json()) as GLTF

		const buffers = await this.loadBuffers(gltf, parentUrl)
		const materials = this.parseMaterials(gltf)
		const scene = this.parseScene(gltf, buffers, materials)

		return { scene }
	}

	private async loadBuffers(gltf: GLTF, parentUrl: string): Promise<ArrayBuffer[]> {
		const bufferPromises =
			gltf.buffers?.map((bufferDef) => {
				if (!bufferDef.uri) throw new Error("Встроенные данные (Data URI) в буферах не поддерживаются.")
				return fetch(parentUrl + bufferDef.uri).then((res) => res.arrayBuffer())
			}) ?? []
		return Promise.all(bufferPromises)
	}

	private parseMaterials(gltf: GLTF): BasicMaterial[] {
		if (!gltf.materials) return []
		return gltf.materials.map((materialDef) => {
			const pbr = materialDef.pbrMetallicRoughness
			if (pbr?.baseColorFactor) {
				const [r, g, b] = pbr.baseColorFactor
				return new BasicMaterial({ color: [r, g, b], wireframe: true })
			}
			return new BasicMaterial({ color: [0.8, 0.8, 0.8], wireframe: true })
		})
	}

	private getAccessorData(gltf: GLTF, accessorIndex: number, buffers: ArrayBuffer[]): BufferAttribute {
		const accessor = gltf.accessors![accessorIndex]
		if (accessor.bufferView === undefined) throw new Error("Разреженные аксессоры не поддерживаются.")

		const bufferView = gltf.bufferViews![accessor.bufferView]
		const buffer = buffers[bufferView.buffer]

		const TypedArray = COMPONENT_TYPE_MAP[accessor.componentType as keyof ComponentTypeMap]
		const componentCount = TYPE_COMPONENT_COUNT[accessor.type]
		const byteOffset = (accessor.byteOffset ?? 0) + (bufferView.byteOffset ?? 0)

		// Создаем view нужного типа и длины, начиная с нужного смещения в общем буфере.
		const data = new TypedArray(buffer.slice(byteOffset))
		const limitedData = data.subarray(0, accessor.count * componentCount)

		return new BufferAttribute(limitedData, componentCount, accessor.normalized ?? false)
	}

	private parsePrimitive(primitiveDef: GLTFPrimitive, gltf: GLTF, buffers: ArrayBuffer[], materials: BasicMaterial[]): Mesh {
		const geometry = new BufferGeometry()
		for (const [name, index] of Object.entries(primitiveDef.attributes)) {
			geometry.setAttribute(name.toLowerCase(), this.getAccessorData(gltf, index, buffers))
		}
		if (primitiveDef.indices !== undefined) {
			geometry.setIndex(this.getAccessorData(gltf, primitiveDef.indices, buffers))
		}
		const material = primitiveDef.material !== undefined ? materials[primitiveDef.material] : new BasicMaterial({ color: [0.8, 0.8, 0.8], wireframe: true })
		return new Mesh({ geometry, material, name: "" })
	}

	private parseMesh(meshDef: GLTFMesh, gltf: GLTF, buffers: ArrayBuffer[], materials: BasicMaterial[]): Object3D {
		if (meshDef.primitives.length === 1) {
			const mesh = this.parsePrimitive(meshDef.primitives[0], gltf, buffers, materials)
			mesh.name = meshDef.name ?? ""
			return mesh
		}

		const group = new Object3D({ name: meshDef.name ?? "" })
		for (const primitive of meshDef.primitives) {
			group.add(this.parsePrimitive(primitive, gltf, buffers, materials))
		}
		return group
	}

	private parseScene(gltf: GLTF, buffers: ArrayBuffer[], materials: BasicMaterial[]): Scene {
		const scene = new Scene()
		const defaultSceneDef = gltf.scenes?.[gltf.scene ?? 0]
		if (!defaultSceneDef || !gltf.nodes) return scene

		const parsedNodes: Object3D[] = gltf.nodes.map((nodeDef) => {
			const obj =
				nodeDef.mesh !== undefined
					? this.parseMesh(gltf.meshes![nodeDef.mesh], gltf, buffers, materials)
					: new Object3D({ name: nodeDef.name ?? "" })

			if (nodeDef.translation) vec3.copy(obj.position, nodeDef.translation)
			if (nodeDef.rotation) quat.copy(obj.quaternion, nodeDef.rotation)
			if (nodeDef.scale) vec3.copy(obj.scale, nodeDef.scale)

			return obj
		})

		gltf.nodes.forEach((nodeDef, i) => {
			nodeDef.children?.forEach((childIndex) => {
				parsedNodes[i].add(parsedNodes[childIndex])
			})
		})

		defaultSceneDef.nodes?.forEach((nodeIndex: number) => scene.add(parsedNodes[nodeIndex]))

		return scene
	}
}
