import { Scene } from "../scenes/Scene"
import { ViewPoint } from "../core/ViewPoint"
import { Mesh } from "../core/Mesh"
import { Object3D } from "../core/Object3D"
import { BufferGeometry } from "../core/BufferGeometry"
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial"
import { Matrix4 } from "../math/Matrix4"
import { LineSegments } from "../objects/LineSegments"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"

// --- Константы для динамических uniform-буферов ---
const UNIFORM_ALIGNMENT = 256
const MAX_RENDERABLES = 1000
const PER_OBJECT_DATA_SIZE = Math.ceil((64 + 16) / UNIFORM_ALIGNMENT) * UNIFORM_ALIGNMENT // (mat4 + vec4) выровнено до 256

// --- Вспомогательные интерфейсы ---
interface GeometryBuffers {
	positionBuffer: GPUBuffer
	colorBuffer?: GPUBuffer
	indexBuffer?: GPUBuffer
}

interface MeshRenderItem {
	type: "mesh"
	mesh: Mesh
	worldMatrix: Matrix4
}

interface LineRenderItem {
	type: "line"
	lines: LineSegments
	worldMatrix: Matrix4
}

type RenderItem = MeshRenderItem | LineRenderItem

export class WebGPURenderer {
	private device: GPUDevice | null = null
	private context: GPUCanvasContext | null = null
	private presentationFormat: GPUTextureFormat | null = null

	// --- Конвейеры рендеринга ---
	private meshPipeline: GPURenderPipeline | null = null
	private linePipeline: GPURenderPipeline | null = null

	// --- Глобальные ресурсы ---
	private globalUniformBuffer: GPUBuffer | null = null
	private globalUniformBindGroup: GPUBindGroup | null = null

	// --- Ресурсы для каждого объекта ---
	private perObjectUniformBuffer: GPUBuffer | null = null
	private perObjectBindGroup: GPUBindGroup | null = null

	private geometryCache: Map<BufferGeometry, GeometryBuffers> = new Map()
	private depthTexture: GPUTexture | null = null
	private multisampleTexture: GPUTexture | null = null
	private sampleCount = 4 // MSAA

	public canvas: HTMLCanvasElement | null = null

	public async init(): Promise<void> {
		if (!navigator.gpu) throw new Error("WebGPU не поддерживается.")
		const adapter = await navigator.gpu.requestAdapter()
		if (!adapter) throw new Error("Не удалось получить WebGPU адаптер.")

		this.device = await adapter.requestDevice()
		this.canvas = document.createElement("canvas")
		this.context = this.canvas.getContext("webgpu")
		if (!this.context) throw new Error("Не удалось получить WebGPU контекст.")

		this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		this.context.configure({
			device: this.device,
			format: this.presentationFormat,
		})

		await this.setupPipelines()
	}

	private async setupPipelines(): Promise<void> {
		if (!this.device || !this.presentationFormat) return

		// --- Общие Layouts и Buffers ---
		this.globalUniformBuffer = this.device.createBuffer({
			size: 64, // mat4x4<f32>
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		this.perObjectUniformBuffer = this.device.createBuffer({
			size: MAX_RENDERABLES * PER_OBJECT_DATA_SIZE,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})

		const globalBindGroupLayout = this.device.createBindGroupLayout({
			entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }],
		})

		this.globalUniformBindGroup = this.device.createBindGroup({
			layout: globalBindGroupLayout,
			entries: [{ binding: 0, resource: { buffer: this.globalUniformBuffer } }],
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
			entries: [{
				binding: 0,
				resource: { buffer: this.perObjectUniformBuffer, size: PER_OBJECT_DATA_SIZE },
			}],
		})

		const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [globalBindGroupLayout, perObjectBindGroupLayout] })

		// --- Pipeline для Meshes ---
		const meshShaderModule = this.device.createShaderModule({ code: this.getMeshShaderCode() })
		this.meshPipeline = await this.device.createRenderPipelineAsync({
			layout: pipelineLayout,
			vertex: {
				module: meshShaderModule,
				entryPoint: "vs_main",
				buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }], // Position
			},
			fragment: {
				module: meshShaderModule,
				entryPoint: "fs_main",
				targets: [{ format: this.presentationFormat }],
			},
			primitive: { topology: "triangle-list" },
			depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus" },
			multisample: { count: this.sampleCount },
		})

		// --- Pipeline для Lines ---
		const lineShaderModule = this.device.createShaderModule({ code: this.getLineShaderCode() })
		this.linePipeline = await this.device.createRenderPipelineAsync({
			layout: pipelineLayout,
			vertex: {
				module: lineShaderModule,
				entryPoint: "vs_main",
				buffers: [
					{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }, // Position
					{ arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] }, // Color
				],
			},
			fragment: {
				module: lineShaderModule,
				entryPoint: "fs_main",
				targets: [{ format: this.presentationFormat }],
			},
			primitive: { topology: "line-list" }, // *** Важно: используем line-list ***
			depthStencil: { depthWriteEnabled: true, depthCompare: "less", format: "depth24plus" },
			multisample: { count: this.sampleCount },
		})
	}

	public setSize(width: number, height: number): void {
		if (this.canvas) {
			this.canvas.width = width
			this.canvas.height = height
		}
	}

	public render(scene: Scene, viewPoint: ViewPoint): void {
		if (!this.device || !this.context || !this.meshPipeline || !this.linePipeline || !this.globalUniformBuffer || !this.canvas) return

		this.updateTextures()

		const commandEncoder = this.device.createCommandEncoder()
		const textureView = this.context.getCurrentTexture().createView()
		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [{
				view: this.multisampleTexture!.createView(),
				resolveTarget: textureView,
				loadOp: "clear",
				storeOp: "store",
				clearValue: { r: scene.background.r, g: scene.background.g, b: scene.background.b, a: 1.0 },
			}],
			depthStencilAttachment: {
				view: this.depthTexture!.createView(),
				depthClearValue: 1.0,
				depthLoadOp: "clear",
				depthStoreOp: "store",
			},
		}

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)

		// Обновляем и устанавливаем глобальные uniform-переменные (матрица проекции-вида)
		const vpMatrix = new Matrix4().multiplyMatrices(viewPoint.projectionMatrix, viewPoint.viewMatrix)
		this.device.queue.writeBuffer(this.globalUniformBuffer, 0, new Float32Array(vpMatrix.elements))
		passEncoder.setBindGroup(0, this.globalUniformBindGroup!)

		// Собираем все видимые объекты в один список
		const renderList: RenderItem[] = []
		this.collectRenderables(scene, new Matrix4(), renderList)

		// --- Рендеринг полигональных сеток (Meshes) ---
		passEncoder.setPipeline(this.meshPipeline)
		for (let i = 0; i < renderList.length; i++) {
			const item = renderList[i]
			if (item.type === "mesh") {
				this.renderMesh(passEncoder, item.mesh, item.worldMatrix, i)
			}
		}

		// --- Рендеринг линий (LineSegments) ---
		passEncoder.setPipeline(this.linePipeline)
		for (let i = 0; i < renderList.length; i++) {
			const item = renderList[i]
			if (item.type === "line") {
				this.renderLines(passEncoder, item.lines, item.worldMatrix, i)
			}
		}

		passEncoder.end()
		this.device.queue.submit([commandEncoder.finish()])
	}

	private collectRenderables(object: Object3D, parentWorldMatrix: Matrix4, renderList: RenderItem[]): void {
		if (!object.visible) return

		const worldMatrix = new Matrix4().multiplyMatrices(parentWorldMatrix, object.modelMatrix)

		if (object instanceof Mesh) {
			renderList.push({ type: "mesh", mesh: object, worldMatrix })
		} else if (object instanceof LineSegments) {
			renderList.push({ type: "line", lines: object, worldMatrix })
		}

		for (const child of object.children) {
			this.collectRenderables(child, worldMatrix, renderList)
		}
	}

	private getOrCreateGeometryBuffers(geometry: BufferGeometry): GeometryBuffers {
		if (this.geometryCache.has(geometry)) {
			return this.geometryCache.get(geometry)!
		}

		if (!this.device) throw new Error("Device not initialized")

		// --- Буфер позиций (обязателен) ---
		const positionBuffer = this.device.createBuffer({
			size: (geometry.attributes.position.array.byteLength + 3) & ~3,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		})
		new Float32Array(positionBuffer.getMappedRange()).set(geometry.attributes.position.array)
		positionBuffer.unmap()

		// --- Буфер цветов (для линий) ---
		let colorBuffer: GPUBuffer | undefined
		if (geometry.attributes.color) {
			colorBuffer = this.device.createBuffer({
				size: (geometry.attributes.color.array.byteLength + 3) & ~3,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
				mappedAtCreation: true,
			})
			new Float32Array(colorBuffer.getMappedRange()).set(geometry.attributes.color.array)
			colorBuffer.unmap()
		}

		// --- Индексный буфер (для indexed-геометрии) ---
		let indexBuffer: GPUBuffer | undefined
		if (geometry.index) {
			const TypedArray = geometry.index.array.length > 65535 ? Uint32Array : Uint16Array
			indexBuffer = this.device.createBuffer({
				size: (geometry.index.array.byteLength + 3) & ~3,
				usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
				mappedAtCreation: true,
			})
			new TypedArray(indexBuffer.getMappedRange()).set(geometry.index.array)
			indexBuffer.unmap()
		}

		const buffers: GeometryBuffers = { positionBuffer, colorBuffer, indexBuffer }
		this.geometryCache.set(geometry, buffers)
		return buffers
	}

	private renderMesh(passEncoder: GPURenderPassEncoder, mesh: Mesh, worldMatrix: Matrix4, renderIndex: number): void {
		if (!this.device || !this.perObjectUniformBuffer || !this.perObjectBindGroup) return

		const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
		if (!material.visible) return

		// Запись данных объекта (матрица и цвет) в uniform-буфер
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

	private renderLines(passEncoder: GPURenderPassEncoder, lines: LineSegments, worldMatrix: Matrix4, renderIndex: number): void {
		if (!this.device || !this.perObjectUniformBuffer || !this.perObjectBindGroup) return
		if (!(lines.material instanceof LineBasicMaterial) || !lines.material.visible) return

		// Запись данных объекта (только матрица, цвет берется из вершин)
		const dynamicOffset = renderIndex * PER_OBJECT_DATA_SIZE
		this.device.queue.writeBuffer(this.perObjectUniformBuffer, dynamicOffset, new Float32Array(worldMatrix.elements))
		passEncoder.setBindGroup(1, this.perObjectBindGroup, [dynamicOffset])

		const { positionBuffer, colorBuffer } = this.getOrCreateGeometryBuffers(lines.geometry)

		passEncoder.setVertexBuffer(0, positionBuffer)
		if (colorBuffer) {
			passEncoder.setVertexBuffer(1, colorBuffer)
		} else {
			// Если у материала нет vertexColors, можно было бы передать сплошной цвет через uniform.
			// Пока что ожидаем, что у GridHelper всегда есть цвета вершин.
			return
		}

		passEncoder.draw(lines.geometry.attributes.position.count)
	}

	// Обновление и создание текстур для рендеринга
	private updateTextures(): void {
		if (!this.device || !this.canvas || !this.presentationFormat) return

		const needsResize = !this.depthTexture || this.depthTexture.width !== this.canvas.width || this.depthTexture.height !== this.canvas.height

		if (needsResize) {
			if (this.depthTexture) this.depthTexture.destroy()
			if (this.multisampleTexture) this.multisampleTexture.destroy()

			const size = { width: this.canvas.width, height: this.canvas.height }

			this.depthTexture = this.device.createTexture({ size, format: "depth24plus", usage: GPUTextureUsage.RENDER_ATTACHMENT, sampleCount: this.sampleCount })
			this.multisampleTexture = this.device.createTexture({ size, format: this.presentationFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT, sampleCount: this.sampleCount })
		}
	}

	// --- Шейдеры ---

	private getMeshShaderCode(): string {
		return `
      struct GlobalUniforms { viewProjectionMatrix: mat4x4<f32> }
      @binding(0) @group(0) var<uniform> globalUniforms: GlobalUniforms;

      struct PerObjectUniforms { modelMatrix: mat4x4<f32>, color: vec4<f32> }
      @binding(0) @group(1) var<uniform> perObject: PerObjectUniforms;

      struct VertexOutput { @builtin(position) position: vec4<f32> }

      @vertex
      fn vs_main(@location(0) pos: vec3<f32>) -> VertexOutput {
        var out: VertexOutput;
        out.position = globalUniforms.viewProjectionMatrix * perObject.modelMatrix * vec4<f32>(pos, 1.0);
        return out;
      }

      @fragment
      fn fs_main() -> @location(0) vec4<f32> {
        return perObject.color;
      }
    `
	}

	private getLineShaderCode(): string {
		return `
      struct GlobalUniforms { viewProjectionMatrix: mat4x4<f32> }
      @binding(0) @group(0) var<uniform> globalUniforms: GlobalUniforms;

      // Для линий мы используем только матрицу модели из этого буфера
      struct PerObjectUniforms { modelMatrix: mat4x4<f32> }
      @binding(0) @group(1) var<uniform> perObject: PerObjectUniforms;

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec3<f32>,
      }

      @vertex
      fn vs_main(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>) -> VertexOutput {
        var out: VertexOutput;
        out.position = globalUniforms.viewProjectionMatrix * perObject.modelMatrix * vec4<f32>(pos, 1.0);
        out.color = color;
        return out;
      }

      @fragment
      fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
        return vec4<f32>(color, 1.0);
      }
    `
	}
}
