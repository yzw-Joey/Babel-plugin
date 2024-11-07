const { declare } = require('@babel/helper-plugin-utils');
const fs = require('fs');
const path = require('path');
const generate = require('@babel/generator').default;

let intlIndex = 0;
function nextIntlKey() {
  ++intlIndex;
  return `intl${intlIndex}`;
}

const autoI18nPlugin2 = declare((api, options, dirname) => {
  api.assertVersion(7);

  function save(file, key, value) {
    const allText = file.get('allText');
    allText.push({
      key,
      value,
    });
    file.set('allText', allText);
  }
  function getReplaceExpression(path, value, intlUid) {
    const expressionParams = path.isTemplateLiteral()
      ? path.node.expressions.map((item) => generate(item).code)
      : null;
    let replaceExpression = api.template.ast(
      `${intlUid}.t('${value}'${
        expressionParams ? ',' + expressionParams.join(',') : ''
      })`
    ).expression;
    if (
      path.findParent((p) => p.isJSXAttribute()) &&
      !path.findParent((p) => p.isJSXExpressionContainer())
    ) {
      replaceExpression = api.types.JSXExpressionContainer(replaceExpression);
    }
    return replaceExpression;
  }

  return {
    pre(file) {
      file.set('allText', []);
    },
    visitor: {
      Program: {
        enter(path, state) {
          let imported;
          path.traverse({
            ImportDeclaration(p) {
              if (p.node.source.value === 'intl') {
                imported = true;
                p.stop();
              }
            },
          });
          if (!imported) {
            const intlUid = path.scope.generateUid('intl');
            const importAst = api.template.ast(`import ${intlUid} from 'intl'`);
            path.node.body.unshift(importAst);
            state.intlUid = intlUid;
          }
          path.traverse({
            'StringLiteral|TemplateLiteral'(path) {
              path;
              if (path.node.leadingComments) {
                path.node.leadingComments = path.node.leadingComments.filter(
                  (comment, index) => {
                    if (comment.value === 'i18n-disable') {
                      path.node.skipTransform = true;
                      return false;
                    }
                    return true;
                  }
                );
              }
              if (path.findParent((p) => p.isImportDeclaration())) {
                path.node.skipTransform = true;
              }
            },
          });
        },
      },
      StringLiteral(path, state) {
        if (path.node.skipTransform) return;
        let key = nextIntlKey();
        save(state.file, key, path.node.value);
        const replaceExpression = getReplaceExpression(
          path,
          key,
          state.intlUid
        );
        path.replaceWith(replaceExpression);
        path.skip();
      },
      TemplateLiteral(path, state) {
        if (path.node.skipTransform) return;
        const value = path
          .get('quasis')
          .map((i) => i.node.value.raw)
          .join('{placeholder}');
        if (value) {
          let key = nextIntlKey();
          save(state.file, key, value);

          const replaceExpression = getReplaceExpression(
            path,
            key,
            state.intlUid
          );

          path.replaceWith(replaceExpression);
          path.skip();
        }
      },
    },
    post(file) {
      const allText = file.get('allText');
      // translate array to an Obj
      const intlData = allText.reduce((obj, item) => {
        obj[item.key] = item.value;
        return obj;
      }, {});

      const content = `export default ${JSON.stringify(intlData, null, 4)}`;
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir);
      }
      fs.writeFileSync(path.join(options.outputDir, 'zh_CH.js'), content);
      fs.writeFileSync(path.join(options.outputDir, 'en.js'), content);
    },
  };
});

module.exports = autoI18nPlugin2;
