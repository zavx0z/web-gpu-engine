import { mat4 } from "gl-matrix"
import type { Scene } from "../scenes/Scene"
import type { ViewPoint } from "../core/ViewPoint"
import { Object3D } from "../core/Object3D"
import { Mesh } from "../core/Mesh"
import { LineSegments } from "../objects/LineSegments"
import { LineBasicMaterial } from "../materials/LineBasicMaterial"

/**
 * Отвечает за рендеринг сцены с использованием WebGPU.
 */
export class WebGPURenderer {
	public canvas: HTMLCanvasElement | null = null
	public adapter: GPUAdapter | null = null
	public device: GPUDevice | null = null
	public context: GPUCanvasContext | null = null
	public solidPipeline: GPURenderPipeline | null = null
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

		this.vertexColorPipeline = this.device.createRenderPipeline({
			layout: "auto",
			vertex: {
				module: vertexColorShaderModule,
				entryPoint: "vertex_main",
				buffers: [
					{
						arrayStride: 12,
						attributes: [
							{ shaderLocation: 0, offset: 0, format: "float32x3" },
						],
					},
					{
						arrayStride: 12,
						attributes: [
							{ shaderLocation: 1, offset: 0, format: "float32x3" },
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

	public render(scene: Scene, viewPoint: ViewPoint): void {
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
					clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
					loadOp: "clear",
					storeOp: "store",
				},
			],
		}

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)

		scene.children.forEach((object: Object3D) => {
			const mvpMatrix = mat4.create()
			mat4.multiply(mvpMatrix, viewPoint.projectionMatrix, viewPoint.viewMatrix)
			mat4.multiply(mvpMatrix, mvpMatrix, object.modelMatrix)

			const uniformBuffer = device.createBuffer({
				size: 64,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})

			device.queue.writeBuffer(uniformBuffer, 0, (mvpMatrix as Float32Array).buffer)

			if ((object as Mesh).isMesh) {
				const mesh = object as Mesh
				if (mesh.geometry.attributes.position && mesh.geometry.index) {
					passEncoder.setPipeline(solidPipeline)

					const positionBuffer = device.createBuffer({
						size: mesh.geometry.attributes.position.array.byteLength,
						usage: GPUBufferUsage.VERTEX,
						mappedAtCreation: true,
					})
					new Float32Array(positionBuffer.getMappedRange()).set(mesh.geometry.attributes.position.array)
					positionBuffer.unmap()

					const indexBuffer = device.createBuffer({
						size: mesh.geometry.index.array.byteLength,
						usage: GPUBufferUsage.INDEX,
						mappedAtCreation: true,
					})
					new Uint16Array(indexBuffer.getMappedRange()).set(mesh.geometry.index.array)
					indexBuffer.unmap()

					const uniformBindGroup = device.createBindGroup({
						layout: solidPipeline.getBindGroupLayout(0),
						entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
					})

					passEncoder.setBindGroup(0, uniformBindGroup)
					passEncoder.setVertexBuffer(0, positionBuffer)
					passEncoder.setIndexBuffer(indexBuffer, "uint16")
					passEncoder.drawIndexed(mesh.geometry.index.count)
				}
			} else if ((object as LineSegments).isLineSegments) {
				const line = object as LineSegments
				if (line.geometry.attributes.position && line.geometry.attributes.color) {
					passEncoder.setPipeline(vertexColorPipeline)

					const positionBuffer = device.createBuffer({
						size: line.geometry.attributes.position.array.byteLength,
						usage: GPUBufferUsage.VERTEX,
						mappedAtCreation: true,
					})
					new Float32Array(positionBuffer.getMappedRange()).set(line.geometry.attributes.position.array)
					positionBuffer.unmap()

					const colorBuffer = device.createBuffer({
						size: line.geometry.attributes.color.array.byteLength,
						usage: GPUBufferUsage.VERTEX,
						mappedAtCreation: true,
					})
					new Float32Array(colorBuffer.getMappedRange()).set(line.geometry.attributes.color.array)
					colorBuffer.unmap()

					const uniformBindGroup = device.createBindGroup({
						layout: vertexColorPipeline.getBindGroupLayout(0),
						entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
					})

					passEncoder.setBindGroup(0, uniformBindGroup)
					passEncoder.setVertexBuffer(0, positionBuffer)
					passEncoder.setVertexBuffer(1, colorBuffer)
					passEncoder.draw(line.geometry.attributes.position.count)
				}
			}
		})

		passEncoder.end()

		device.queue.submit([commandEncoder.finish()])
	}
}
