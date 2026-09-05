import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(resolve(directory, entry.name))
          : [resolve(directory, entry.name)],
      ),
    )
  ).flat();
}
const tracked = (
  await Promise.all(
    [
      "frontend-astro/src/pages",
      "frontend-astro/src/components",
      "frontend-astro/src/layouts",
      "frontend-astro/src/scripts",
      "frontend-astro/src/styles",
    ].map((path) => files(resolve(root, path))),
  )
)
  .flat()
  .sort();
const entries = await Promise.all(
  tracked.map(async (path) => {
    const content = await readFile(path, "utf8");
    return {
      file: relative(root, path).replaceAll("\\", "/"),
      sha256: createHash("sha256")
        .update(content.replaceAll("\r\n", "\n"))
        .digest("hex"),
      ...(path.replaceAll("\\", "/").includes("/pages/")
        ? {
            route:
              relative(resolve(root, "frontend-astro/src/pages"), path)
                .replaceAll("\\", "/")
                .replace(/\.(astro|ts)$/, "")
                .replace(/(^|\/)index$/, "")
                .replace(/^/, "/") || "/",
          }
        : {}),
    };
  }),
);
const output = resolve(root, "docs/refactor/ui-inventory.json");
const baseline =
  JSON.stringify(
    {
      schema: 1,
      description: "UI source baseline; does not contain database or user data",
      entries,
    },
    null,
    2,
  ) + "\n";
if (process.argv.includes("--capture")) {
  await mkdir(resolve(root, "docs/refactor"), { recursive: true });
  await writeFile(output, baseline, { flag: "wx" });
  console.log(
    `Captured ${entries.length} UI source files. Existing baselines are never overwritten.`,
  );
} else {
  const previous = JSON.parse(await readFile(output, "utf8"));
  const current = new Map(entries.map((entry) => [entry.file, entry]));
  const changes = previous.entries.filter(
    (entry) => current.get(entry.file)?.sha256 !== entry.sha256,
  );
  const known = new Set(previous.entries.map((entry) => entry.file));
  const added = entries.filter((entry) => !known.has(entry.file));
  console.log(
    JSON.stringify(
      {
        changedOrRemoved: changes.map((entry) => entry.file),
        added: added.map((entry) => entry.file),
      },
      null,
      2,
    ),
  );
  if (changes.length || added.length) process.exitCode = 1;
}
