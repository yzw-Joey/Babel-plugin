const tranverseModuleFn = require('./tranverse-module');
const path = require('path');
const fs = require('fs');

const dependenceGraph = tranverseModuleFn(
  path.resolve(__dirname, './test-proj/index.js')
);

// console.log(dependenceGraph);
fs.writeFileSync(
  'output.json',
  JSON.stringify(dependenceGraph, null, 4),
  'utf-8'
);
