import { file } from "bun"
import main from "./index.html"

Bun.serve({
  // Используем порт из переменной окружения $PORT, по умолчанию 3000
  port: process.env.PORT || 3000,
  hostname: "0.0.0.0",
  development: {
    hmr: true,
    console: true,
  },
  routes: {
    "/": main,
    "/JetBrainsMono-Bold.ttf": file("./static/JetBrainsMono-Bold.ttf"),
    "/models/engine/2CylinderEngine.gltf": file("./static/models/engine/2CylinderEngine.gltf"),
    "/models/engine/2CylinderEngine0.bin": file("./static/models/engine/2CylinderEngine0.bin"),
    // "/gl-matrix.js": new Response(Bun.file("./gl-matrix.js"), {
    //   headers: {
    //     "Content-Type": "application/javascript",
    //   },
    // })
  },
})

console.log(`Bun server running at http://0.0.0.0:${process.env.PORT || 3000}`)
