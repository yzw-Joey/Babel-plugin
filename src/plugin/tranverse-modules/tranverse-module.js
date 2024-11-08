const fs = require('fs');
const parser = require('@babel/parser');
const { traverse } = require('@babel/core');
const path = require('path');
const DependenceNode = require('./dependence-node');

const IMPORT_TYPE = {
  deconstruct: 'deconstruct',
  default: 'default',
  namespace: 'namespace',
};

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (e) {}
  return false;
}

const completePath = (requirePath) => {
  const EXTS = ['.tsx', '.jsx', '.ts', '.js'];
  if (requirePath.match(/.\[A-Za-z]+$/)) return requirePath;

  function tryCompleted(requirePath) {
    for (let i = 0; i < EXTS.length; i++) {
      const fullPath = requirePath + EXTS[i];
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  if (isDirectory(requirePath)) {
    const tryFullPath = tryCompleted(path.join(requirePath, 'index'));
    if (tryFullPath) {
      return tryFullPath;
    }
  } else {
    return tryCompleted(requirePath);
  }
};

const moduleResolve = (curPath, subModulePath) => {
  // 防止循环引用
  let requirePath = path.resolve(path.dirname(curPath), subModulePath);

  if (requirePath.includes('node_modules')) return '';

  requirePath = completePath(requirePath);

  return requirePath;
};

const tranverseJsModule = (curPath, dependenceNode, allModules) => {
  const fileContent = fs.readFileSync(curPath, 'utf-8');

  const ast = parser.parse(fileContent, {
    sourceType: 'unambiguous',
  });

  traverse(ast, {
    ImportDeclaration(path, state) {
      const subModulePath = moduleResolve(curPath, path.node.source.value);
      if (!subModulePath) return;

      // const specifiers = path.node.specifiers;
      const specifiers = path.get('specifiers');

      dependenceNode.imports[subModulePath] = specifiers.map((specifier) => {
        if (specifier.isImportSpecifier()) {
          return {
            type: IMPORT_TYPE.deconstruct,
            imported: specifier.get('imported').node.name,
            local: specifier.get('local').node.name,
          };
        } else if (specifier.isImportDefaultSpecifier()) {
          return {
            type: IMPORT_TYPE.default,
            local: specifier.get('local').node.name,
          };
        } else {
          return {
            type: IMPORT_TYPE.namespace,
            local: specifier.get('local').node.name,
          };
        }
      });
      const subModuleNode = new DependenceNode(subModulePath);
      dependenceNode.subModules[subModulePath] = subModuleNode;
      tranverseJsModule(subModulePath, subModuleNode, allModules);
      allModules[path] = dependenceNode;
    },
  });
};

const tranverseModuleFn = (path) => {
  const root = new DependenceNode(path);
  const allModules = {};
  const dependenceGraph = {
    root,
    allModules,
  };
  tranverseJsModule(path, root, allModules);

  return dependenceGraph;
};

module.exports = tranverseModuleFn;
