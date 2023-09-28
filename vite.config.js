export default {
    build: {
      rollupOptions: {
        input: ['src/content.js', 'src/background.js'],
        output: {
          dir: 'dist',
          entryFileNames: '[name].js',
        },
      },
    },
  };