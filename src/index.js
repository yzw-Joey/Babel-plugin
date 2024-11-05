const { transformSync } = require('@babel/core');
const fs = require('fs');
const path = require('path');

const sourceCode = fs
  .readFileSync(path.resolve(__dirname, 'source.js'))
  .toString('utf-8');

const result = transformSync(sourceCode, {
  presets: [['@babel/preset-react', { runtime: 'automatic' }]],
});

console.log(result);
