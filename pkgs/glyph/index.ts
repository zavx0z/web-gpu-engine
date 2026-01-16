/// <reference types="@webgpu/types" />
import { TrueTypeFont } from "./TrueTypeFont"

// -------------------- Инициализация WebGPU --------------------
const adapter = await navigator.gpu.requestAdapter()
if (!adapter) throw new Error("WebGPU адаптер не найден")

const device = await adapter.requestDevice()

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!
const context = canvas.getContext("webgpu")!
context.configure({
  device,
  format: navigator.gpu.getPreferredCanvasFormat(),
})

// ... остальной код ...
