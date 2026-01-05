
import { Scene } from "../scenes/Scene"
import { ViewPoint } from "../core/ViewPoint"
import { Mesh } from "../core/Mesh"
import { Object3D } from "../core/Object3D"
import { BufferGeometry } from "../core/BufferGeometry"
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial"
import { Matrix4 } from "../math/Matrix4"

// --- Константы для динамических uniform-буферов ---
const UNIFORM_ALIGNMENT = 256
const MAX_RENDERABLES = 1000
// Размер данных: mat4x4<f32> (64 байта) + vec4<f32> (16 байт) = 80 байт. Выравниваем до 256.
const PER_OBJECT_DATA_SIZE = Math.ceil((64 + 16) / UNIFORM_ALIGNMENT) * UNIFORM_ALIGNMENT

interface GeometryBuffers {
	positionBuffer: GPUBuffer
	indexBuffer?: GPUBuffer
}

interface RenderItem {
	mesh: Mesh
	worldMatrix: Matrix4
}

export class WebGPURenderer {
	private device: GPUDevice | null = null
	private context: GPUCanvasContext | null = null
	private presentationFormat: GPUTextureFormat | null = null
	private renderPipeline: GPURenderPipeline | null = null

	private globalUniformBuffer: GPUBuffer | null = null
	private globalUniformBindGroup: GPUBindGroup | null = null

	private perObjectUniformBuffer: GPUBuffer | null = null
	private perObjectBindGroup: GPUBindGroup | null = null

	private geometryCache: Map<BufferGeometry, GeometryBuffers> = new Map()
	private depthTexture: GPUTexture | null = null

	public canvas: HTMLCanvasElement | null = null

	public async init(): Promise<void> {
		if (!navigator.gpu) {
			throw new Error("WebGPU не поддерживается в этом браузере.")
		}

		const adapter = await navigator.gpu.requestAdapter()
		if (!adapter) {
			throw new Error("Не удалось получить WebGPU адаптер.")
		}

		this.device = await adapter.requestDevice()
		this.canvas = document.createElement("canvas")
		this.context = this.canvas.getContext("webgpu")

		if (!this.context) {
			throw new Error("Не удалось получить контекст WebGPU.")
		}

		this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		this.context.configure({
			device: this.device,
			format: this.presentationFormat,
		})

		await this.setupRenderPipeline()
	}

	private async setupRenderPipeline(): Promise<void> {
		if (!this.device || !this.presentationFormat) return

		this.globalUniformBuffer = this.device.createBuffer({
			size: 64, // mat4x4<f32>
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		const globalBindGroupLayout = this.device.createBindGroupLayout({
			entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
		})

		this.globalUniformBindGroup = this.device.createBindGroup({
			layout: globalBindGroupLayout,
			entries: [{ binding: 0, resource: { buffer: this.globalUniformBuffer } }],
		})

		this.perObjectUniformBuffer = this.device.createBuffer({
			size: MAX_RENDERABLES * PER_OBJECT_DATA_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		const perObjectBindGroupLayout = this.device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform", hasDynamicOffset: true },
				},
			],
		})

		this.perObjectBindGroup = this.device.createBindGroup({
			layout: perObjectBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.perObjectUniformBuffer,
						size: PER_OBJECT_DATA_SIZE,
					},
				},
			],
		})

		const pipelineLayout = this.device.createPipelineLayout({
			bindGroupLayouts: [globalBindGroupLayout, perObjectBindGroupLayout],
		})

		const shaderModule = this.device.createShaderModule({ code: this.getShaderCode() })

		this.renderPipeline = await this.device.createRenderPipelineAsync({
			layout: pipelineLayout,
			vertex: {
				module: shaderModule,
				entryPoint: "vs_main",
				buffers: [
					{
						arrayStride: 12, // sizeof(vec3<f32>)
						attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
					},
				],
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fs_main",
				targets: [{ format: this.presentationFormat }],
			},
			primitive: {
				topology: "triangle-list",
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: "less",
				format: "depth24plus",
			},
		})
	}

	public setSize(width: number, height: number): void {
		if (this.canvas) {
			this.canvas.width = width
			this.canvas.height = height
		}
	}

	public render(scene: Scene, viewPoint: ViewPoint): void {
		if (!this.device || !this.context || !this.renderPipeline || !this.globalUniformBuffer || !this.globalUniformBindGroup || !this.canvas) return

		// --- Управление текстурой глубины ---
		if (!this.depthTexture || this.depthTexture.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height) {
			if (this.depthTexture) {
				this.depthTexture.destroy()
			}
			this.depthTexture = this.device.createTexture({
				size: [this.canvas.width, this.canvas.height],
				format: "depth24plus",
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
			})
		}

		const commandEncoder = this.device.createCommandEncoder()
		const textureView = this.context.getCurrentTexture().createView()

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: "clear",
					storeOp: "store",
					clearValue: { r: scene.background.r, g: scene.background.g, b: scene.background.b, a: 1.0 },
				},
			],
			depthStencilAttachment: {
				view: this.depthTexture.createView(),
				depthClearValue: 1.0,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
		}

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
		passEncoder.setPipeline(this.renderPipeline)

		const vpMatrix = new Matrix4().multiplyMatrices(viewPoint.projectionMatrix, viewPoint.viewMatrix)
		this.device.queue.writeBuffer(this.globalUniformBuffer, 0, new Float32Array(vpMatrix.elements))
		passEncoder.setBindGroup(0, this.globalUniformBindGroup)

		const renderList: RenderItem[] = []
		this.collectRenderables(scene, new Matrix4(), renderList)

		for (let i = 0; i < renderList.length; i++) {
			const item = renderList[i]
			this.renderMesh(passEncoder, item.mesh, item.worldMatrix, i)
		}

		passEncoder.end()
		this.device.queue.submit([commandEncoder.finish()])
	}

	private collectRenderables(object: Object3D, parentWorldMatrix: Matrix4, renderList: RenderItem[]): void {
		if (!object.visible) return

		const worldMatrix = new Matrix4().multiplyMatrices(parentWorldMatrix, object.modelMatrix)

		if (object instanceof Mesh) {
			renderList.push({ mesh: object, worldMatrix })
		}

		for (const child of object.children) {
			this.collectRenderables(child, worldMatrix, renderList)
		}
	}

	private getOrCreateGeometryBuffers(geometry: BufferGeometry): GeometryBuffers {
		if (this.geometryCache.has(geometry)) {
			return this.geometryCache.get(geometry)!
		}

		const positionBuffer = this.device!.createBuffer({
			size: (geometry.attributes.position.array.byteLength + 3) & ~3,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		})
		new Float32Array(positionBuffer.getMappedRange()).set(geometry.attributes.position.array)
		positionBuffer.unmap()

		let indexBuffer: GPUBuffer | undefined
		if (geometry.index) {
			const TypedArray = geometry.index.array.length > 65535 ? Uint32Array : Uint16Array
			indexBuffer = this.device!.createBuffer({
				size: (geometry.index.array.byteLength + 3) & ~3,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
				mappedAtCreation: true,
			})
			new TypedArray(indexBuffer.getMappedRange()).set(geometry.index.array)
			indexBuffer.unmap()
		}

		const buffers: GeometryBuffers = { positionBuffer, indexBuffer }
		this.geometryCache.set(geometry, buffers)
		return buffers
	}

	private renderMesh(passEncoder: GPURenderPassEncoder, mesh: Mesh, worldMatrix: Matrix4, renderIndex: number): void {
		if (!this.device || !this.perObjectUniformBuffer || !this.perObjectBindGroup) return

		const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
		if (!material.visible) return

		const dynamicOffset = renderIndex * PER_OBJECT_DATA_SIZE

		if (material instanceof MeshBasicMaterial) {
			const objectData = new Float32Array(PER_OBJECT_DATA_SIZE / 4)
			objectData.set(worldMatrix.elements, 0)
			objectData.set(material.color.toArray(), 16)

			this.device.queue.writeBuffer(this.perObjectUniformBuffer, dynamicOffset, objectData)
		}

		passEncoder.setBindGroup(1, this.perObjectBindGroup, [dynamicOffset])

		const { positionBuffer, indexBuffer } = this.getOrCreateGeometryBuffers(mesh.geometry)

		passEncoder.setVertexBuffer(0, positionBuffer)

		if (indexBuffer) {
			const indexFormat = mesh.geometry.index!.array.length > 65535 ? "uint32" : "uint16"
			passEncoder.setIndexBuffer(indexBuffer, indexFormat)
			passEncoder.drawIndexed(mesh.geometry.index!.count)
		} else {
			passEncoder.draw(mesh.geometry.attributes.position.count)
		}
	}

	private getShaderCode(): string {
		return `
      struct GlobalUniforms {
        viewProjectionMatrix: mat4x4<f32>,
      }
      @binding(0) @group(0) var<uniform> globalUniforms: GlobalUniforms;

      struct PerObjectUniforms {
        modelMatrix: mat4x4<f32>,
        color: vec4<f32>,
      }
      @binding(0) @group(1) var<uniform> perObject: PerObjectUniforms;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
      }

      @vertex
      fn vs_main(@location(0) local_position: vec3<f32>) -> VertexOutput {
        var out: VertexOutput;
        out.position = globalUniforms.viewProjectionMatrix * perObject.modelMatrix * vec4<f32>(local_position, 1.0);
        return out;
      }

      @fragment
      fn fs_main() -> @location(0) vec4<f32> {
        return perObject.color;
      }
    `
	}
}
