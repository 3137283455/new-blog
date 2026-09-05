import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createConnection } from "node:net";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const owned = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  // Only stop children created by this invocation; never enumerate/kill other Node apps.
  for (const child of owned) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

async function ready(url, marker) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.ok && (await response.text()).includes(marker);
  } catch {
    return false;
  }
}

async function start({ name, cwd, args, url, marker, env = {} }) {
  if (await ready(url, marker)) {
    console.log(`[refactor] Reusing ${name}: ${url}`);
    return;
  }
  const target = new URL(url);
  const listening = await new Promise((resolve) => {
    const socket = createConnection({
      host: target.hostname,
      port: Number(target.port),
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
  if (listening) {
    // A cold Next/Astro route can compile longer than a health-check timeout.
    // Give that existing process time; do not start a competing server on its port.
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await ready(url, marker)) {
        console.log(`[refactor] Reusing ${name}: ${url}`);
        return;
      }
      await delay(500);
    }
    throw new Error(
      `Port ${target.port} is occupied but ${name} is not healthy. No existing process was stopped.`,
    );
  }
  const child = spawn(process.execPath, args, {
    cwd: `${repo}/${cwd}`,
    env: {
      ...process.env,
      ...env,
      NEXT_TELEMETRY_DISABLED: "1",
      ASTRO_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
    windowsHide: true,
  });
  owned.push(child);
  child.on("error", (error) => {
    console.error(`[refactor] ${name}: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(
        `[refactor] ${name} exited (${code}). Check its port and dependencies.`,
      );
      stop(1);
    }
  });
  for (let attempt = 0; attempt < 90; attempt++) {
    if (await ready(url, marker)) return;
    await delay(500);
  }
  throw new Error(`${name} did not become ready: ${url}`);
}

try {
  await access(`${repo}/backend/dist/app.js`);
  await access(`${repo}/frontend-astro/node_modules/astro/astro.js`);
  await access(`${repo}/apps/web/node_modules/next/dist/bin/next`);
  await start({
    name: "legacy API",
    cwd: "backend",
    args: ["dist/app.js"],
    url: "http://127.0.0.1:3001/api/health",
    marker: '"status":"ok"',
  });
  await start({
    name: "legacy pages",
    cwd: "frontend-astro",
    args: [
      "node_modules/astro/astro.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "4321",
    ],
    url: "http://127.0.0.1:4321/manga/search",
    marker: "data-manga-experience",
  });
  await start({
    name: "Next preview",
    cwd: "apps/web",
    args: [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    url: "http://127.0.0.1:3100/manga/search",
    marker: "_next/",
    env: {
      API_BASE_INTERNAL: "http://127.0.0.1:3001",
      LEGACY_WEB_ORIGIN: "http://127.0.0.1:4321",
    },
  });
  console.log(
    "\n[refactor] Preview: http://127.0.0.1:3100/manga\n[refactor] Original: http://127.0.0.1:4321/manga\n[refactor] No database cutover; no production port change.",
  );
} catch (error) {
  console.error(
    `[refactor] ${error.message}\nInstall dependencies and build backend first; see docs/refactor/README.md.`,
  );
  stop(1);
}
