export default {
	build: {
		rollupOptions: {
			input: "src/content2.js",
			output: {
				format: "iife",
				name: "content2",
				dir: "dist",
				entryFileNames: "[name].js",
			},
		},
	},
};
