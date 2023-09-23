export default {
    build: {
      rollupOptions: {
        input: 'src/content.js',
        output: {
          dir: 'dist',
          entryFileNames: '[name].js',
        },
      },
    },
  };