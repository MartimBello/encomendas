import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const workspace = process.cwd();
const conductorPort = Number.parseInt(process.env.CONDUCTOR_PORT || "", 10);
const useIsolatedStack = process.env.CONDUCTOR_IS_LOCAL === "1" && Number.isInteger(conductorPort);
const playwrightArgs = process.argv.slice(2);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspace,
    env: options.env || process.env,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) process.stderr.write(result.stderr || result.stdout || "");
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
  return result;
}

function replaceRequired(contents, from, to, label) {
  if (!from.test(contents)) throw new Error(`Could not configure ${label} for the isolated E2E stack.`);
  return contents.replace(from, to);
}

function setServiceEnabled(contents, section, enabled) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`(\\[${escaped}\\][\\s\\S]*?\\nenabled\\s*=\\s*)(true|false)`);
  return replaceRequired(contents, expression, `$1${enabled}`, section);
}

function parseStatus(output) {
  return Object.fromEntries(output.split("\n").flatMap((line) => {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}

function prepareIsolatedWorkdir(target, basePort) {
  const targetSupabase = resolve(target, "supabase");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(resolve(workspace, "supabase"), targetSupabase, {
    recursive: true,
    filter: (source) => !source.split("/").includes(".temp"),
  });

  const configPath = resolve(targetSupabase, "config.toml");
  let config = readFileSync(configPath, "utf8");
  config = replaceRequired(config, /^project_id = ".*"$/m, `project_id = "encomendas-e2e-${basePort}"`, "project ID");
  const ports = new Map([
    [54321, basePort],
    [54322, basePort + 1],
    [54320, basePort + 2],
    [54323, basePort + 3],
    [54324, basePort + 4],
    [54327, basePort + 5],
    [8083, basePort + 6],
    [54329, basePort + 9],
  ]);
  for (const [original, isolated] of ports) {
    config = replaceRequired(config, new RegExp(`(port|shadow_port|inspector_port) = ${original}\\b`), `$1 = ${isolated}`, `port ${original}`);
  }
  for (const service of ["studio", "local_smtp", "storage", "storage.s3_protocol", "storage.vector", "analytics"]) {
    config = setServiceEnabled(config, service, false);
  }
  writeFileSync(configPath, config);
}

if (!useIsolatedStack) {
  process.exit(run("npx", ["playwright", "test", ...playwrightArgs], { allowFailure: true }).status ?? 1);
}

const isolatedWorkdir = resolve(workspace, ".context", "e2e-supabase");
let stackStarted = false;
let exitCode = 1;

try {
  prepareIsolatedWorkdir(isolatedWorkdir, conductorPort);
  run("npx", ["supabase", "stop", "--no-backup", "--workdir", isolatedWorkdir], { allowFailure: true });
  run("npx", [
    "supabase", "start", "--workdir", isolatedWorkdir,
    "--exclude", "imgproxy,mailpit,postgres-meta,studio,storage-api,logflare,vector,supavisor",
  ]);
  stackStarted = true;

  const statusResult = run("npx", ["supabase", "status", "-o", "env", "--workdir", isolatedWorkdir], { capture: true });
  const status = parseStatus(statusResult.stdout);
  const appPort = conductorPort + 7;
  const env = {
    ...process.env,
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${appPort}`,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL || `http://127.0.0.1:${conductorPort}`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY || status.ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    PLAYWRIGHT_PORT: String(appPort),
  };
  exitCode = run("npx", ["playwright", "test", ...playwrightArgs], { env, allowFailure: true }).status ?? 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
} finally {
  if (stackStarted) run("npx", ["supabase", "stop", "--no-backup", "--workdir", isolatedWorkdir], { allowFailure: true });
  rmSync(isolatedWorkdir, { recursive: true, force: true });
}

process.exit(exitCode);
