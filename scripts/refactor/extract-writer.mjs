// One-time mechanical extraction from the frozen writer. Maintain resulting modules directly.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { transform } from '../../frontend-astro/node_modules/@astrojs/compiler/dist/node/index.js';
import ts from '../../apps/web/node_modules/typescript/lib/typescript.js';
const directory = new URL('../../apps/web/src/features/writer/', import.meta.url);
await mkdir(directory, { recursive: true });
const original = await readFile(new URL('../../frontend-astro/src/pages/admin/write.astro', import.meta.url), 'utf8');
const compiled = await transform(original, { filename: 'writer.astro', scopedStyleStrategy: 'attribute' });
const attribute = [...new Set(compiled.code.match(/data-astro-cid-[a-z0-9]+/g))][0];
await writeFile(new URL('writer.css', directory), compiled.css.join('\n'));
await writeFile(new URL('scope-attribute.ts', directory), `export const writerScopeAttribute=${JSON.stringify(attribute)};\n`);
const f = ts.factory, printer = ts.createPrinter();
const markup = original.slice(original.indexOf('<main class="writer-shell"'), original.indexOf('<script is:inline src='));
const jsx = ts.createSourceFile('writer.tsx', `const view=<>${markup}</>;`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (jsx.parseDiagnostics.length) throw new Error(ts.flattenDiagnosticMessageText(jsx.parseDiagnostics[0].messageText, '\n'));
const aliases = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autocomplete: 'autoComplete', spellcheck: 'spellCheck', maxlength: 'maxLength' };
const result = ts.transform(jsx, [context => root => {
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(jsx);
      const attrs = node.attributes.properties.filter(attr => !ts.isJsxAttribute(attr) || attr.name.getText(jsx) !== 'selected').map(attr => {
        if (!ts.isJsxAttribute(attr)) return attr;
        const name = attr.name.getText(jsx), key = name === 'value' && tag === 'input' ? 'defaultValue' : aliases[name] || name;
        const value = ['tabindex', 'maxlength', 'rows', 'cols'].includes(name) && attr.initializer && ts.isStringLiteral(attr.initializer) ? f.createJsxExpression(undefined, f.createNumericLiteral(attr.initializer.text)) : attr.initializer;
        return f.updateJsxAttribute(attr, f.createIdentifier(key), value);
      });
      attrs.push(f.createJsxAttribute(f.createIdentifier(attribute), f.createStringLiteral('')));
      if (tag === 'select' && node.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(jsx) === 'id' && attr.initializer?.text === 'heading-level')) attrs.push(f.createJsxAttribute(f.createIdentifier('defaultValue'), f.createStringLiteral('2')));
      const props = f.createJsxAttributes(attrs);
      return ts.isJsxOpeningElement(node) ? f.updateJsxOpeningElement(node, node.tagName, node.typeArguments, props) : f.updateJsxSelfClosingElement(node, node.tagName, node.typeArguments, props);
    }
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitNode(root, visit);
}]);
await writeFile(new URL('writer-view.tsx', directory), `export function WriterView(){return (${printer.printNode(ts.EmitHint.Unspecified, result.transformed[0].statements[0].declarationList.declarations[0].initializer, jsx)});}\n`);
result.dispose();
let helpers = await readFile(new URL('../../frontend-astro/public/admin-write-utils.js', import.meta.url), 'utf8');
helpers = helpers.replace(/^;\(\(\) => \{/, '').replace(/\}\)\(\)\s*$/, '').replace('window.WriterUtils =', 'export const writerUtils =');
await writeFile(new URL('markdown.js', directory), helpers);
let script = original.slice(original.indexOf('<script is:inline>', original.indexOf('<body')) + '<script is:inline>'.length, original.lastIndexOf('</script>'));
script = script.replace("const writerUtils = window.WriterUtils || {}", '').replace("if (!token) location.replace('/admin')", "if (!token) { location.replace('/admin'); return; }");
const controller = ts.createSourceFile('controller.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const js = ts.transform(controller, [context => root => {
  const call = (method, args) => f.createCallExpression(f.createPropertyAccessExpression(f.createIdentifier('scope'), method), undefined, args);
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'addEventListener') return call('listen', [ts.visitNode(expr.expression, visit), ...node.arguments.map(arg => ts.visitNode(arg, visit))]);
      const method = ts.isIdentifier(expr) ? expr.text : ts.isPropertyAccessExpression(expr) && expr.expression.getText(controller) === 'window' ? expr.name.text : '';
      if (['fetch', 'setTimeout', 'requestAnimationFrame'].includes(method)) return call(({ fetch: 'fetch', setTimeout: 'timeout', requestAnimationFrame: 'frame' })[method], node.arguments.map(arg => ts.visitNode(arg, visit)));
      if (ts.isPropertyAccessExpression(expr) && expr.expression.getText(controller) === 'document' && ['querySelector', 'querySelectorAll'].includes(expr.name.text)) return call(expr.name.text === 'querySelector' ? 'query' : 'queryAll', node.arguments.map(arg => ts.visitNode(arg, visit)));
    }
    if (ts.isCatchClause(node)) return f.updateCatchClause(node, node.variableDeclaration, f.updateBlock(node.block, [f.createIfStatement(f.createPropertyAccessExpression(f.createIdentifier('scope'), 'disposed'), f.createReturnStatement()), ...node.block.statements.map(statement => ts.visitNode(statement, visit))]));
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitNode(root, visit);
}]);
await writeFile(new URL('controller.js', directory), `import {writerUtils} from './markdown';\nexport function mount(scope){\n${printer.printFile(js.transformed[0])}\nscope.defer(()=>{if(isDirty){try{localStorage.setItem(autosaveKey(),JSON.stringify(collectLocalDraft()));}catch{}}previewController?.abort();articleListController?.abort();currentArticleController?.abort();});\n}\n`);
js.dispose();
console.log('Extracted standalone writer view, scoped styles, markdown utilities and lifecycle controller.');
