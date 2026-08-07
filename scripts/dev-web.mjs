#!/usr/bin/env node
import { spawn } from "node:child_process";
import { applyLanSideEffects, getLanLocalIpAddress, loadRootEnv, rootDir } from "./lan.mjs";

const rootEnv = loadRootEnv();
const lan = getLanLocalIpAddress(rootEnv);
const overrides = applyLanSideEffects(lan);

const env = {
  ...process.env,
  ...rootEnv,
  ...overrides,
};

const nextArgs = lan
  ? ["exec", "next", "dev", "-H", "0.0.0.0", "-p", "3002"]
  : ["exec", "next", "dev", "-p", "3002"];

const child = spawn("pnpm", nextArgs, {
  cwd: `${rootDir}/apps/web`,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
