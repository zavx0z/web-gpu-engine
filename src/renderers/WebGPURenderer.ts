import { mat4 } from "gl-matrix"
import { Scene } from "../scenes/Scene"
import { ViewPoint } from "../core/ViewPoint"
import { Mesh } from "../core/Mesh"
import { Object3D } from "../core/Object3D"
import { BufferGeometry } from "../core/BufferGeometry"

interface GeometryBuffers {
	positionBuffer: GPUBuffer
	indexBuffer?: GPUBuffer
}

interface RenderItem {
	mesh: Mesh
	worldMatrix: mat4
}

/**
 * Отрисовщик, использующий технологию WebGPU для рендеринга 3D-сцен.
 */
export class WebGPURenderer {
	private device: GPUDevice | null = null
	private context: GPUCanvasContext | null = null
	private presentationFormat: GPUTextureFormat | null = null
	private renderPipeline: GPURenderPipeline | null = null
	private uniformBuffer: GPUBuffer | null = null
	private uniformBindGroup: GPUBindGroup | null = null
	private geometryCache: Map<BufferGeometry, GeometryBuffers> = new Map()

	/**
	 * HTML-элемент canvas, на котором происходит отрисовка.
	 */
	public canvas: HTMLCanvasElement | null = null

	/**
	 * Инициализирует WebGPU, настраивает устройство и контекст.
	 * @returns Promise, который разрешается после успешной инициализации.
	 */
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

		this.setupRenderPipeline()
	}

	private setupRenderPipeline(): void {
		if (!this.device || !this.presentationFormat) return

		this.uniformBuffer = this.device.createBuffer({
			size: 64 * 2, // 2 матрицы 4x4 (view-projection и model)
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		const bindGroupLayout = this.device.createBindGroupLayout({
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: { type: "uniform" },
				},
			],
		})

		this.uniformBindGroup = this.device.createBindGroup({
			layout: bindGroupLayout,
			entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
		})

		const pipelineLayout = this.device.createPipelineLayout({
			bindGroupLayouts: [bindGroupLayout],
		})

		const shaderModule = this.device.createShaderModule({
			code: `
        struct Uniforms {
          viewProjectionMatrix: mat4x4<f32>,
          modelMatrix: mat4x4<f32>,
        }

        @binding(0) @group(0) var<uniform> uniforms: Uniforms;

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
        }

        @vertex
        fn vs_main(@location(0) position: vec4<f32>) -> VertexOutput {
          var out: VertexOutput;
          out.position = uniforms.viewProjectionMatrix * uniforms.modelMatrix * position;
          return out;
        }

        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
          return vec4<f32>(1.0, 1.0, 1.0, 1.0); // Возвращаем белый цвет
        }
      `,
		})

		this.renderPipeline = this.device.createRenderPipeline({
			layout: pipelineLayout,
			vertex: {
				module: shaderModule,
				entryPoint: "vs_main",
				buffers: [
					{
						arrayStride: 12, // 3 * 4 байта (vec3<f32>)
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
		})
	}

	public setSize(width: number, height: number): void {
		if (this.canvas) {
			this.canvas.width = width
			this.canvas.height = height
		}
	}

	public render(scene: Scene, viewPoint: ViewPoint): void {
		if (!this.device || !this.context || !this.renderPipeline || !this.uniformBuffer) return

		const commandEncoder = this.device.createCommandEncoder()
		const textureView = this.context.getCurrentTexture().createView()

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					loadOp: "clear",
					storeOp: "store",
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
				},
			],
		}

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
		passEncoder.setPipeline(this.renderPipeline)

		const vpMatrix = mat4.create()
		mat4.multiply(vpMatrix, viewPoint.projectionMatrix, viewPoint.viewMatrix)
		this.device.queue.writeBuffer(this.uniformBuffer, 0, vpMatrix as unknown as ArrayBuffer)

		const renderList: RenderItem[] = []
		this.collectRenderables(scene, mat4.create(), renderList)

		for (const item of renderList) {
			this.renderMesh(passEncoder, item.mesh, item.worldMatrix)
		}

		passEncoder.end()
		this.device.queue.submit([commandEncoder.finish()])
	}

	private collectRenderables(object: Object3D, parentWorldMatrix: mat4, renderList: RenderItem[]): void {
		if (!object.visible) return

		const worldMatrix = mat4.create()
		mat4.multiply(worldMatrix, parentWorldMatrix, object.modelMatrix)

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
			size: geometry.attributes.position.array.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		})
		this.device!.queue.writeBuffer(positionBuffer, 0, geometry.attributes.position.array)

		let indexBuffer: GPUBuffer | undefined
		if (geometry.index) {
			indexBuffer = this.device!.createBuffer({
				size: geometry.index.array.byteLength,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
			})
			this.device!.queue.writeBuffer(indexBuffer, 0, geometry.index.array)
		}

		const buffers: GeometryBuffers = { positionBuffer, indexBuffer }
		this.geometryCache.set(geometry, buffers)
		return buffers
	}

	private renderMesh(passEncoder: GPURenderPassEncoder, mesh: Mesh, worldMatrix: mat4): void {
		if (!this.device || !this.uniformBindGroup || !this.uniformBuffer) return

		this.device.queue.writeBuffer(this.uniformBuffer, 64, worldMatrix as unknown as ArrayBuffer)
		passEncoder.setBindGroup(0, this.uniformBindGroup)

		const { positionBuffer, indexBuffer } = this.getOrCreateGeometryBuffers(mesh.geometry)

		passEncoder.setVertexBuffer(0, positionBuffer)

		if (indexBuffer) {
			const indexFormat = mesh.geometry.index!.array instanceof Uint16Array ? "uint16" : "uint32"
			passEncoder.setIndexBuffer(indexBuffer, indexFormat)
			passEncoder.drawIndexed(mesh.geometry.index!.count)
		} else {
			passEncoder.draw(mesh.geometry.attributes.position.count)
		}
	}
}
