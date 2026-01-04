import main from "./index.html"

Bun.serve({
	// Используем порт из переменной окружения $PORT, по умолчанию 3000
	port: process.env.PORT || 3000,
	hostname: "0.0.0.0",
	development: {
		hmr: true,
	},
	routes: {
		"/": main,
		// "/gl-matrix.js": new Response(Bun.file("./gl-matrix.js"), {
		//   headers: {
		//     "Content-Type": "application/javascript",
		//   },
		// })
	},
})

console.log(`Bun server running at http://0.0.0.0:${process.env.PORT || 3000}`)
