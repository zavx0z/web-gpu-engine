import { mat4 } from "gl-matrix"
import type { Scene } from "../scenes/Scene"
import type { PerspectiveCamera } from "../cameras/PerspectiveCamera"
import { Object3D } from "../core/Object3D"
import { Mesh } from "../core/Mesh"
import { LineSegments } from "../objects/LineSegments"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"
import { Material } from "../materials/Material"

/**
 * Отвечает за рендеринг сцены с использованием WebGPU.
 */
export class WebGPURenderer {
	public canvas: HTMLCanvasElement | null = null
	public adapter: GPUAdapter | null = null
	public device: GPUDevice | null = null
	public context: GPUCanvasContext | null = null

	// Конвейер для стандартных объектов (сплошная заливка/линии)
	public solidPipeline: GPURenderPipeline | null = null
	// Конвейер для объектов с цветами вершин
	public vertexColorPipeline: GPURenderPipeline | null = null

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

		// --- Шейдер для сплошных объектов ---
		const solidShaderModule = this.device.createShaderModule({
			code: `
                struct Uniforms {
                    modelViewProjectionMatrix : mat4x4<f32>,
                };
                @binding(0) @group(0) var<uniform> uniforms : Uniforms;

                @vertex
                fn vertex_main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
                    return uniforms.modelViewProjectionMatrix * vec4<f32>(position, 1.0);
                }

                @fragment
                fn fragment_main() -> @location(0) vec4<f32> {
                    return vec4<f32>(1.0, 1.0, 1.0, 1.0); // Белый цвет
                }
            `,
		})

		// --- Конвейер для сплошных объектов (каркас тора) ---
		this.solidPipeline = this.device.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: solidShaderModule,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 12, // 3 * float32
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
				module: solidShaderModule,
				entryPoint: "fragment_main",
				targets: [{ format: presentationFormat }],
			},
			primitive: {
				topology: "line-list",
			},
		})

		// --- Шейдер для объектов с цветами вершин (AxesHelper) ---
		const vertexColorShaderModule = this.device.createShaderModule({
			code: `
                struct Uniforms {
                    modelViewProjectionMatrix : mat4x4<f32>,
                };
                @binding(0) @group(0) var<uniform> uniforms : Uniforms;

                struct VertexInput {
                    @location(0) position : vec3<f32>,
                    @location(1) color: vec3<f32>,
                };

                struct VertexOutput {
                    @builtin(position) position : vec4<f32>,
                    @location(0) color : vec4<f32>,
                };

                @vertex
                fn vertex_main(input: VertexInput) -> VertexOutput {
                    var output : VertexOutput;
                    output.position = uniforms.modelViewProjectionMatrix * vec4<f32>(input.position, 1.0);
                    output.color = vec4<f32>(input.color, 1.0);
                    return output;
                }

                @fragment
                fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
                    return input.color;
                }
            `,
		})

		// --- Конвейер для объектов с цветами вершин ---
		this.vertexColorPipeline = this.device.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: vertexColorShaderModule,
				entryPoint: "vertex_main",
				buffers: [
					// 0: Буфер позиций
					{
						arrayStride: 12, // 3 * float32
						attributes: [
							{
								shaderLocation: 0,
								offset: 0,
								format: "float32x3",
							},
						],
					},
					// 1: Буфер цветов
					{
						arrayStride: 12, // 3 * float32
						attributes: [
							{
								shaderLocation: 1,
								offset: 0,
								format: "float32x3",
							},
						],
					},
				],
			},
			fragment: {
				module: vertexColorShaderModule,
				entryPoint: "fragment_main",
				targets: [{ format: presentationFormat }],
			},
			primitive: {
				topology: "line-list",
			},
		})
	}

	public setSize(width: number, height: number): void {
		if (!this.canvas) return
		this.canvas.width = width
		this.canvas.height = height
	}

	public render(scene: Scene, camera: PerspectiveCamera): void {
		const { device, context, solidPipeline, vertexColorPipeline } = this
		if (!device || !context || !solidPipeline || !vertexColorPipeline) {
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

		scene.children.forEach((object: Object3D) => {
			const modelMatrix = object.modelMatrix
			const mvpMatrix = mat4.create()
			const modelViewMatrix = mat4.create()
			mat4.multiply(modelViewMatrix, camera.viewMatrix, modelMatrix)
			mat4.multiply(mvpMatrix, camera.projectionMatrix, modelViewMatrix)

			const uniformBuffer = device.createBuffer({
				size: 64, // mat4x4<f32>
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})
			device.queue.writeBuffer(uniformBuffer, 0, mvpMatrix as Float32Array)

			// --- Рендеринг LineSegments (например, AxesHelper) ---
			if ((object as LineSegments).isLineSegments) {
				const line = object as LineSegments
				const material = line.material as LineBasicMaterial

				if (
					material.vertexColors &&
					line.geometry.attributes.position &&
					line.geometry.attributes.color
				) {
					passEncoder.setPipeline(vertexColorPipeline)

					const positionAttribute = line.geometry.attributes.position
					const colorAttribute = line.geometry.attributes.color

					const positionBuffer = device.createBuffer({
						size: positionAttribute.array.byteLength,
						usage: GPUBufferUsage.VERTEX,
						mappedAtCreation: true,
					})
					new Float32Array(positionBuffer.getMappedRange()).set(positionAttribute.array as Float32Array)
					positionBuffer.unmap()

					const colorBuffer = device.createBuffer({
						size: colorAttribute.array.byteLength,
						usage: GPUBufferUsage.VERTEX,
						mappedAtCreation: true,
					})
					new Float32Array(colorBuffer.getMappedRange()).set(colorAttribute.array as Float32Array)
					colorBuffer.unmap()

					const uniformBindGroup = device.createBindGroup({
						layout: vertexColorPipeline.getBindGroupLayout(0),
						entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
					})
					passEncoder.setBindGroup(0, uniformBindGroup)
					passEncoder.setVertexBuffer(0, positionBuffer)
					passEncoder.setVertexBuffer(1, colorBuffer)
					passEncoder.draw(positionAttribute.array.length / 3, 1, 0, 0)
				}
			}
			// --- Рендеринг Mesh (например, Torus) ---
			else if ((object as Mesh).isMesh) {
				const mesh = object as Mesh

				if (mesh.geometry.attributes.position && mesh.geometry.index) {
					passEncoder.setPipeline(solidPipeline)

					const positionAttribute = mesh.geometry.attributes.position
					const indexAttribute = mesh.geometry.index

					const vertexBuffer = device.createBuffer({
						size: positionAttribute.array.byteLength,
						usage: GPUBufferUsage.VERTEX,
						mappedAtCreation: true,
					})
					new Float32Array(vertexBuffer.getMappedRange()).set(positionAttribute.array as Float32Array)
					vertexBuffer.unmap()

					const indexBuffer = device.createBuffer({
						size: indexAttribute.array.byteLength,
						usage: GPUBufferUsage.INDEX,
						mappedAtCreation: true,
					})
					new Uint16Array(indexBuffer.getMappedRange()).set(indexAttribute.array as Uint16Array)
					indexBuffer.unmap()

					const uniformBindGroup = device.createBindGroup({
						layout: solidPipeline.getBindGroupLayout(0),
						entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
					})

					passEncoder.setBindGroup(0, uniformBindGroup)
					passEncoder.setVertexBuffer(0, vertexBuffer)
					passEncoder.setIndexBuffer(indexBuffer, "uint16")
					passEncoder.drawIndexed(indexAttribute.array.length, 1, 0, 0, 0)
				}
			}
		})

		passEncoder.end()

		device.queue.submit([commandEncoder.finish()])
	}
}
