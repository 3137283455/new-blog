import { readFile, writeFile } from "node:fs/promises";
import postcss from "../../frontend-astro/node_modules/postcss/lib/postcss.mjs";
const source = await readFile(
  new URL("../../frontend-astro/src/pages/reading.astro", import.meta.url),
  "utf8",
);
const css = postcss.parse(source.match(/<style>([\s\S]*?)<\/style>/)[1]);
css.walkRules((rule) => {
  const selectors = rule.selectors.filter(
    (selector) =>
      !/^\.(?:reading-item|reading-progress|reading-empty)(?:\W|$)/.test(
        selector,
      ),
  );
  if (selectors.length) rule.selectors = selectors;
  else rule.remove();
});
await writeFile(
  new URL(
    "../../apps/web/src/features/reading/reading-hub.css",
    import.meta.url,
  ),
  "/* Dynamic legacy records did not carry Astro scopes. */\n" + css.toString(),
);
