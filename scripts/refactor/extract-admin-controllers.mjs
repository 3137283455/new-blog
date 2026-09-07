// Preserve controller behavior while extracting top-level actions by business domain.
// TypeScript binding identities (not text replacements) keep local shadowed variables intact.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "../../apps/web/node_modules/typescript/lib/typescript.js";
const output = new URL(
  "../../apps/web/src/features/admin/controllers/",
  import.meta.url,
);
await mkdir(output, { recursive: true });
const printer = ts.createPrinter();
const f = ts.factory;
for (const name of [
  "core",
  "extra",
  "personal",
  "books",
  "content-center",
  "manga",
  "search-sources",
]) {
  const filename = fileURLToPath(
    new URL(
      `../../frontend-astro/src/scripts/admin-${name}.js`,
      import.meta.url,
    ),
  );
  const program = ts.createProgram([filename], {
    allowJs: true,
    noResolve: true,
    noLib: true,
  });
  const source = program.getSourceFile(filename),
    checker = program.getTypeChecker();
  const symbols = new Map();
  if (name === "core")
    for (const statement of source.statements) {
      const declarations = ts.isVariableStatement(statement)
        ? statement.declarationList.declarations
        : ts.isFunctionDeclaration(statement)
          ? [statement]
          : [];
      for (const declaration of declarations) {
        if (!ts.isIdentifier(declaration.name))
          throw new Error("Review destructured top-level admin binding");
        symbols.set(
          checker.getSymbolAtLocation(declaration.name),
          declaration.name.text,
        );
      }
    }
  const scope = () =>
    name === "core"
      ? f.createPropertyAccessExpression(f.createIdentifier("context"), "scope")
      : f.createIdentifier("scope");
  const access = (key) =>
    f.createPropertyAccessExpression(f.createIdentifier("context"), key);
  const transformed = ts.transform(source, [
    (context) => (root) => {
      const visit = (node) => {
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          if (ts.isPropertyAccessExpression(expression)) {
            const method = expression.name.text,
              owner = expression.expression;
            if (
              ts.isIdentifier(owner) &&
              owner.text === "window" &&
              method === "notifyAdmin"
            )
              return f.createCallExpression(
                f.createPropertyAccessExpression(scope(), "notify"),
                undefined,
                node.arguments.map((arg) => ts.visitNode(arg, visit)),
              );
            if (method === "addEventListener")
              return f.createCallExpression(
                f.createPropertyAccessExpression(scope(), "listen"),
                undefined,
                [
                  ts.visitNode(owner, visit),
                  ...node.arguments.map((arg) => ts.visitNode(arg, visit)),
                ],
              );
            if (
              ts.isIdentifier(owner) &&
              owner.text === "document" &&
              ["querySelector", "querySelectorAll", "getElementById"].includes(
                method,
              )
            )
              return f.createCallExpression(
                f.createPropertyAccessExpression(
                  scope(),
                  {
                    querySelector: "query",
                    querySelectorAll: "queryAll",
                    getElementById: "byId",
                  }[method],
                ),
                undefined,
                node.arguments.map((arg) => ts.visitNode(arg, visit)),
              );
            if (
              owner.getText(source) === "document.body" &&
              method === "append" &&
              node.arguments[0]?.getText(source) === "menu"
            )
              return f.createCallExpression(
                f.createPropertyAccessExpression(scope(), "moveToBody"),
                undefined,
                node.arguments.map((arg) => ts.visitNode(arg, visit)),
              );
          }
          const method = ts.isIdentifier(expression)
            ? expression.text
            : ts.isPropertyAccessExpression(expression) &&
                expression.expression.getText(source) === "window"
              ? expression.name.text
              : "";
          if (["setTimeout", "requestAnimationFrame", "fetch"].includes(method))
            return f.createCallExpression(
              f.createPropertyAccessExpression(
                scope(),
                {
                  setTimeout: "timeout",
                  requestAnimationFrame: "frame",
                  fetch: "fetch",
                }[method],
              ),
              undefined,
              node.arguments.map((arg) => ts.visitNode(arg, visit)),
            );
        }
        if (ts.isCatchClause(node))
          return f.updateCatchClause(
            node,
            node.variableDeclaration,
            f.updateBlock(node.block, [
              f.createIfStatement(
                f.createPropertyAccessExpression(scope(), "disposed"),
                f.createReturnStatement(),
              ),
              ...node.block.statements.map((statement) =>
                ts.visitNode(statement, visit),
              ),
            ]),
          );
        if (ts.isIdentifier(node)) {
          const symbol = checker.getSymbolAtLocation(node),
            key = symbols.get(symbol);
          const parent = node.parent;
          const declarationName =
            (ts.isVariableDeclaration(parent) ||
              ts.isFunctionDeclaration(parent)) &&
            parent.name === node;
          const propertyName =
            (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
            (ts.isPropertyAssignment(parent) && parent.name === node);
          if (key && !declarationName && !propertyName) return access(key);
        }
        if (ts.isShorthandPropertyAssignment(node)) {
          const symbol = checker.getShorthandAssignmentValueSymbol(node),
            key = symbols.get(symbol);
          if (key) return f.createPropertyAssignment(node.name, access(key));
        }
        return ts.visitEachChild(node, visit, context);
      };
      return ts.visitNode(root, visit);
    },
  ]);
  const statements = transformed.transformed[0].statements;
  const print = (node) =>
    printer.printNode(ts.EmitHint.Unspecified, node, source);
  if (name === "core") {
    const groups = new Map(),
      boot = [];
    const domain = (key) =>
      /media|folder|upload|picker/i.test(key)
        ? "media"
        : /music|playlist/i.test(key)
          ? "music"
          : /backup|database|import|export/i.test(key)
            ? "backup"
            : /article|editor|markdown/i.test(key)
              ? "articles"
              : /comment/i.test(key)
                ? "comments"
                : /categor|tag|pageform|pages|page$/i.test(key)
                  ? "content"
                  : /theme|setting|font|profile|account|plugin/i.test(key)
                    ? "settings"
                    : "shell";
    for (const statement of statements) {
      if (ts.isFunctionDeclaration(statement)) {
        const key = statement.name.text,
          group = domain(key);
        if (!groups.has(group)) groups.set(group, []);
        const fn = f.createFunctionExpression(
          statement.modifiers,
          statement.asteriskToken,
          statement.name,
          statement.typeParameters,
          statement.parameters,
          statement.type,
          statement.body,
        );
        groups
          .get(group)
          .push(
            print(
              f.createExpressionStatement(f.createAssignment(access(key), fn)),
            ),
          );
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations)
          boot.push(
            print(
              f.createExpressionStatement(
                f.createAssignment(
                  access(declaration.name.text),
                  declaration.initializer || f.createIdentifier("undefined"),
                ),
              ),
            ),
          );
      } else boot.push(print(statement));
    }
    for (const [group, actions] of groups)
      await writeFile(
        new URL(`core-${group}.js`, output),
        `export function register(context){\n${actions.join("\n")}\n}\n`,
      );
    await writeFile(
      new URL("core.js", output),
      [...groups.keys()]
        .map(
          (group, index) =>
            `import {register as register${index}} from './core-${group}';`,
        )
        .join("\n") +
        `\nexport function mount(scope){const context={scope};${[...groups.keys()].map((_, index) => `register${index}(context);`).join("")}\n${boot.join("\n")}\n}\n`,
    );
  } else {
    const imports = statements
      .filter(ts.isImportDeclaration)
      .map(print)
      .join("\n");
    await writeFile(
      new URL(`${name}.js`, output),
      `${imports}\nexport function mount(scope){\n${statements
        .filter((statement) => !ts.isImportDeclaration(statement))
        .map(print)
        .join("\n")}\n}\n`,
    );
  }
  transformed.dispose();
}
await writeFile(
  new URL("bookmark-import.js", output),
  await readFile(
    new URL(
      "../../frontend-astro/src/scripts/bookmark-import.js",
      import.meta.url,
    ),
    "utf8",
  ),
);
console.log(
  "Extracted lifecycle-bound admin controllers and grouped core actions.",
);
