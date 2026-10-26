// Local verification only; never print credentials, their hashes, or matching file contents.
import { readFile, readdir, writeFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const values = Object.fromEntries((await readFile(resolve(root, ".env.local"), "utf8")).split(/\r?\n/)
  .filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => {
    const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
  }));
const roles = ["ADMIN", "RECEPTION", "TRAINER", "MEMBER"];
const allowed = new Set(["GYMFLOW_API_URL", "APP_ORIGIN", "SESSION_SECRET", "COOKIE_SECURE", "NEXT_PUBLIC_ORGANIZATION_ID", "NEXT_PUBLIC_ORGANIZATION_NAME", ...roles.flatMap(r => [`GYMFLOW_E2E_${r}_EMAIL`, `GYMFLOW_E2E_${r}_PASSWORD`])]);
const report = {
  ignoredByProjectRule: (await readFile(resolve(root, ".gitignore"), "utf8")).split(/\r?\n/).includes(".env*"),
  onlyLocalConfiguration: Object.keys(values).every(k => allowed.has(k)) && values.GYMFLOW_API_URL === "http://127.0.0.1:5080" && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(values.APP_ORIGIN),
  onlyFictitiousE2EAccounts: roles.every(r => values[`GYMFLOW_E2E_${r}_EMAIL`] === `${r.toLowerCase()}.e2e@example.test` && values[`GYMFLOW_E2E_${r}_PASSWORD`]?.length >= 32),
  noPublicSecretVariables: !Object.keys(values).some(k => k.startsWith("NEXT_PUBLIC_") && /PASSWORD|SECRET|TOKEN|KEY/.test(k)),
  repositoryPresent: spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, encoding: "utf8" }).status === 0,
  envTracked: false, scannedFiles: 0, exposedSecrets: false,
};
if (report.repositoryPresent) report.envTracked = !!spawnSync("git", ["ls-files", "--", ".env.local"], { cwd: root, encoding: "utf8" }).stdout.trim();
const secrets = [values.SESSION_SECRET, ...roles.map(r => values[`GYMFLOW_E2E_${r}_PASSWORD`])].filter(Boolean)
  .flatMap(v => [Buffer.from(v), Buffer.from(Buffer.from(v).toString("base64"))]);
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (entry.isFile()) {
      const data = await readFile(file); report.scannedFiles++;
      if (secrets.some(secret => data.includes(secret))) report.exposedSecrets = true;
    }
  }
}
await access(resolve(root, ".next/static")); // require an actual production build
for (const directory of ["src", "public", "tests", "docs", "scripts", ".next/static"]) {
  try { await scan(resolve(root, directory)); }
  catch (error) { if (directory !== "public" || error.code !== "ENOENT") throw error; }
}
await writeFile(resolve(root, "artifacts/patch-secrets.json"), JSON.stringify(report, null, 2));
const pass = report.ignoredByProjectRule && report.onlyLocalConfiguration && report.onlyFictitiousE2EAccounts && report.noPublicSecretVariables && !report.envTracked && !report.exposedSecrets;
console.log(`Local credential isolation: ${pass ? "PASS" : "FAIL"}; ${report.scannedFiles} source/public/test files inspected. No values logged.`);
if (!pass) process.exitCode = 1;
