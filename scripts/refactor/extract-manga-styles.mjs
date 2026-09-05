// Mechanical extraction only: no visual values are rewritten.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const components = [
  ["MangaSiteHeader", null],
  ["MangaSourcePicker", null],
  ["MangaPortal", ".manga-home"],
  ["MangaBrowsePage", ".manga-browse"],
];
const output = new URL(
  "../../apps/web/src/features/manga/styles/",
  import.meta.url,
);
await mkdir(output, { recursive: true });
const { default: postcss } =
  await import("../../frontend-astro/node_modules/postcss/lib/postcss.mjs");
const { format } =
  await import("../../apps/web/node_modules/prettier/index.mjs");
for (const [name, scope] of components) {
  const source = await readFile(
    new URL(
      `../../frontend-astro/src/components/${name}.astro`,
      import.meta.url,
    ),
    "utf8",
  );
  const css = source.match(/<style>\s*([\s\S]*?)\s*<\/style>/)?.[1];
  if (!css) throw new Error(`Missing styles: ${name}`);
  const ast = postcss.parse(css);
  ast.walkRules((rule) => {
    // Astro's scoped styles never matched nodes inserted by the old innerHTML renderer.
    // Preserve the OBSERVED UI, not an unapproved repair of the old intended design.
    if (
      /\.manga-result-(card|cover)|\.manga-source-(item|empty)/.test(
        rule.selector,
      )
    ) {
      rule.remove();
      return;
    }
    rule.selectors = rule.selectors.map((selector) => {
      selector = selector.replaceAll(
        ".manga-result-empty",
        ".manga-result-empty[data-initial-placeholder]",
      );
      if (!scope) return selector;
      const scoped = selector.startsWith(scope)
        ? selector
        : `:where(${scope}) ${selector}`;
      // Child components did not inherit their parent's Astro scope attributes.
      return `${scoped}:not(:where(.manga-source-picker *, .manga-site-header *))`;
    });
  });
  const target = new URL(`${name}.css`, output);
  const formatted = await format(
    `/* Preserved from ${name}.astro. Values frozen by UI parity tests.\n * Inactive dynamic-node rules intentionally excluded; see docs/refactor/README.md. */\n${ast.toString()}\n`,
    { parser: "css", printWidth: 100, singleQuote: true },
  );
  await writeFile(target, formatted, {
    flag: process.argv.includes("--refresh") ? "w" : "wx",
  });
  console.log(fileURLToPath(target));
}
