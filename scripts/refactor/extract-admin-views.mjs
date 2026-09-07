// Mechanical JSX conversion of the frozen admin UI, split at existing panel/dialog boundaries.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import ts from "../../apps/web/node_modules/typescript/lib/typescript.js";
const directory = new URL(
  "../../apps/web/src/features/admin/views/",
  import.meta.url,
);
await mkdir(directory, { recursive: true });
const original = await readFile(
  new URL("../../frontend-astro/src/pages/admin.astro", import.meta.url),
  "utf8",
);
let markup = original
  .slice(
    original.indexOf('<section class="admin-shell"'),
    original.lastIndexOf("<script>"),
  )
  .replace(/<!--([\s\S]*?)-->/g, "{/*$1*/}");
markup = markup
  .replace("data-api-base={apiBase}", 'data-api-base="/api"')
  .replace(
    '<article class="ryu-card p-5">',
    '<article class="ryu-card p-5" key={key}>',
  );
const source = ts.createSourceFile(
  "views.tsx",
  `const view=<>${markup}</>;`,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
if (source.parseDiagnostics.length)
  throw new Error(
    ts.flattenDiagnosticMessageText(
      source.parseDiagnostics[0].messageText,
      "\n",
    ),
  );
const aliases = {
  class: "className",
  for: "htmlFor",
  autocomplete: "autoComplete",
  maxlength: "maxLength",
  minlength: "minLength",
  tabindex: "tabIndex",
  rowspan: "rowSpan",
  colspan: "colSpan",
  readonly: "readOnly",
  spellcheck: "spellCheck",
  autofocus: "autoFocus",
  crossorigin: "crossOrigin",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
};
const printer = ts.createPrinter();
const panels = [];
const transformer = (context) => (root) => {
  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source),
        tag = node.parent.parent.tagName.getText(source);
      const replacement =
        name === "checked"
          ? "defaultChecked"
          : name === "value" && ["input", "textarea", "select"].includes(tag)
            ? "defaultValue"
            : aliases[name];
      const numeric =
        [
          "maxlength",
          "minlength",
          "tabindex",
          "rowspan",
          "colspan",
          "rows",
          "cols",
          "size",
        ].includes(name) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer);
      if (replacement || numeric)
        return ts.factory.updateJsxAttribute(
          node,
          ts.factory.createIdentifier(replacement || name),
          numeric
            ? ts.factory.createJsxExpression(
                undefined,
                ts.factory.createNumericLiteral(node.initializer.text),
              )
            : node.initializer,
        );
    }
    if (ts.isJsxElement(node)) {
      const id = node.openingElement.attributes.properties.find(
        (attr) => ts.isJsxAttribute(attr) && attr.name.getText(source) === "id",
      )?.initializer?.text;
      if (
        id &&
        (id.endsWith("-panel") ||
          node.openingElement.tagName.getText(source) === "dialog")
      ) {
        const name = id
          .split("-")
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join("");
        panels.push({
          name,
          id,
          node: ts.visitEachChild(node, visit, context),
        });
        return ts.factory.createJsxSelfClosingElement(
          ts.factory.createIdentifier(name),
          undefined,
          ts.factory.createJsxAttributes([]),
        );
      }
    }
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitNode(root, visit);
};
const result = ts.transform(source, [transformer]);
const frame =
  result.transformed[0].statements[0].declarationList.declarations[0]
    .initializer;
for (const { name, id, node } of panels) {
  await writeFile(
    new URL(`${id}.tsx`, directory),
    `export function ${name}(){return (${printer.printNode(ts.EmitHint.Unspecified, node, source)});}\n`,
  );
}
await writeFile(
  new URL("admin-view.tsx", directory),
  panels.map(({ name, id }) => `import {${name}} from './${id}';`).join("\n") +
    `\nexport function AdminView(){return (${printer.printNode(ts.EmitHint.Unspecified, frame, source)});}\n`,
);
result.dispose();
console.log(
  `Extracted ${panels.length} existing admin panels/dialogs into React views.`,
);
