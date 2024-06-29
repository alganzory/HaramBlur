export default {
    build: {
        rollupOptions: {
            input: "src/content.js",
            output: {
                format: "iife",
                name: "content",
                dir: "dist",
                entryFileNames: "[name].js",
            },
        },
    },
};
