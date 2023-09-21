const path = require('path');

module.exports = {
  entry: {
    content: path.join(__dirname, 'src/content.js'),
    background: path.join(__dirname, 'src/background.js'),
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
};
