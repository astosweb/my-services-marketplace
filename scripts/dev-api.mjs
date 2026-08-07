#!/usr/bin/env node
import { spawn } from "node:child_process";
import { applyLanSideEffects, getLanLocalIpAddress, loadRootEnv, rootDir } from "./lan.mjs";

const rootEnv = loadRootEnv();
const lan = getLanLocalIpAddress(rootEnv);
const overrides = applyLanSideEffects(lan);

const env = {
  ...process.env,
  ...overrides,
};

const child = spawn("pnpm", ["--filter", "@gobid/api", "dev"], {
  cwd: rootDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
