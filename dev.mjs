import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";

const children = [];
const require = createRequire(import.meta.url);
const reactScriptsBin = require.resolve("react-scripts/bin/react-scripts.js");

function run(command, args, name, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });

  children.push(child);

  child.on("exit", code => {
    if (code !== 0) {
      shutdown(code || 1);
    }
  });
}

function shutdown(code = 0) {
  while (children.length) {
    const child = children.pop();
    if (child && !child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function probePort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort = 4001, attempts = 20) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    const available = await probePort(candidate);
    if (available) return candidate;
  }
  return startPort;
}

async function boot() {
  const apiPort = await findAvailablePort(Number(process.env.PORT || 4001));
  const clientPort = await findAvailablePort(Number(process.env.CLIENT_PORT || 3000));
  console.log(`Local API port: ${apiPort}`);
  console.log(`Local editor URL: http://localhost:${clientPort}`);
  run("node", ["server.mjs"], "api", { PORT: String(apiPort) });
  run(process.execPath, [reactScriptsBin, "start"], "client", {
    BROWSER: "none",
    PORT: String(clientPort),
    REACT_APP_API_PORT: String(apiPort),
  });
}

boot().catch((error) => {
  console.error("Dev baslatilamadi:", error);
  shutdown(1);
});
