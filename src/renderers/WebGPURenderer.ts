import { mat4 } from "gl-matrix"
import type { Scene } from "../scenes/Scene"
import type { PerspectiveCamera } from "../cameras/PerspectiveCamera"
import type { Mesh } from "../core/Mesh"

/**
 * Отвечает за рендеринг сцены с использованием WebGPU.
 */
export class WebGPURenderer {
	/**
	 * Элемент canvas, на котором происходит отрисовка.
	 */
	public canvas: HTMLCanvasElement | null = null
	/**
	 * Физическое устройство GPU.
	 */
	public adapter: GPUAdapter | null = null
	/**
	 * Логическое устройство WebGPU, используемое для выполнения команд.
	 */
	public device: GPUDevice | null = null
	/**
	 * Контекст холста, на котором происходит отрисовка.
	 */
	public context: GPUCanvasContext | null = null
	/**
	 * Конвейер рендеринга, содержащий шейдеры и конфигурацию.
	 */
	public pipeline: GPURenderPipeline | null = null

	/**
	 * Асинхронно инициализирует WebGPU, запрашивает адаптер и устройство,
	 * создает холст и настраивает конвейер рендеринга.
	 * @returns Promise, который разрешается после завершения инициализации.
	 */
	public async init(): Promise<void> {
		if (!navigator.gpu) {
			throw new Error("WebGPU не поддерживается в этом браузере.")
		}

		this.adapter = await navigator.gpu.requestAdapter()
		if (!this.adapter) {
			throw new Error("Не найден подходящий GPUAdapter.")
		}

		this.device = await this.adapter.requestDevice()

		this.canvas = document.createElement("canvas")
		this.canvas.width = window.innerWidth
		this.canvas.height = window.innerHeight
		document.body.appendChild(this.canvas)

		this.context = this.canvas.getContext("webgpu")
		if (!this.context) {
			throw new Error("Не удалось получить контекст WebGPU.")
		}

		const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		this.context.configure({
			device: this.device,
			format: presentationFormat,
		})

		const shaderModule = this.device.createShaderModule({
			code: `
        struct Uniforms {
          modelViewProjectionMatrix : mat4x4<f32>,
        };
        @binding(0) @group(0) var<uniform> uniforms : Uniforms;

        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
        };

        @vertex
        fn vertex_main(@location(0) position : vec4<f32>) -> VertexOutput {
          var output : VertexOutput;
          output.Position = uniforms.modelViewProjectionMatrix * position;
          return output;
        }

        @fragment
        fn fragment_main() -> @location(0) vec4<f32> {
          return vec4<f32>(1.0, 1.0, 1.0, 1.0);
        }
      `,
		})

		this.pipeline = this.device.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: shaderModule,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 12, // 3 * 4 bytes
						attributes: [
							{
								shaderLocation: 0,
								offset: 0,
								format: "float32x3",
							},
						],
					},
				],
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fragment_main",
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
			primitive: {
				topology: "line-list",
			},
		})
	}

	/**
	 * Устанавливает размер холста для рендеринга.
	 * @param width Ширина.
	 * @param height Высота.
	 */
	public setSize(width: number, height: number): void {
		if (!this.canvas) {
			return
		}
		this.canvas.width = width
		this.canvas.height = height
	}

	/**
	 * Рендерит один кадр сцены.
	 * @param scene Сцена для рендеринга.
	 * @param camera Камера, с точки зрения которой происходит рендеринг.
	 */
	public render(scene: Scene, camera: PerspectiveCamera): void {
		const { device, context, pipeline } = this
		if (!device || !context || !pipeline) {
			return
		}

		const commandEncoder = device.createCommandEncoder()
		const textureView = context.getCurrentTexture().createView()

		const renderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
					loadOp: "clear",
					storeOp: "store",
				},
			],
		}

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
		passEncoder.setPipeline(pipeline)

		scene.children.forEach((object: Mesh) => {
			if (object.isMesh) {
				const vertexBuffer = device.createBuffer({
					size: object.geometry.vertices.byteLength,
					usage: GPUBufferUsage.VERTEX,
					mappedAtCreation: true,
				})
				new Float32Array(vertexBuffer.getMappedRange()).set(
					object.geometry.vertices,
				)
				vertexBuffer.unmap()

				const indexBuffer = device.createBuffer({
					size: object.geometry.indices.byteLength,
					usage: GPUBufferUsage.INDEX,
					mappedAtCreation: true,
				})
				new Uint16Array(indexBuffer.getMappedRange()).set(
					object.geometry.indices,
				)
				indexBuffer.unmap()

				const mvpMatrix = mat4.create()
				const modelViewMatrix = mat4.create()
				mat4.multiply(modelViewMatrix, camera.viewMatrix, object.modelMatrix)
				mat4.multiply(mvpMatrix, camera.projectionMatrix, modelViewMatrix)

				const uniformBuffer = device.createBuffer({
					size: 64, // mat4x4<f32>
					usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				})

				device.queue.writeBuffer(
					uniformBuffer,
					0,
					mvpMatrix as Float32Array,
				)

				const uniformBindGroup = device.createBindGroup({
					layout: pipeline.getBindGroupLayout(0),
					entries: [
						{
							binding: 0,
							resource: { buffer: uniformBuffer },
						},
					],
				})

				passEncoder.setBindGroup(0, uniformBindGroup)
				passEncoder.setVertexBuffer(0, vertexBuffer)
				passEncoder.setIndexBuffer(indexBuffer, "uint16")
				passEncoder.drawIndexed(object.geometry.indices.length, 1, 0, 0, 0)
			}
		})

		passEncoder.end()

		device.queue.submit([commandEncoder.finish()])
	}
}
