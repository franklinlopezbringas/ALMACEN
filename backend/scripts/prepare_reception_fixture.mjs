// Optional local demo fixture; never changes schema, users, credentials or history.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(root, "backend/artifacts/reception-fixture.json");
const previous = JSON.parse(await readFile(output, "utf8").catch(() => "{}"));
const text = execFileSync("sqlcmd", ["-S", ".\\SQLEXPRESS", "-E", "-C", "-b", "-f", "65001", "-i", resolve(root, "database/tests/ReceptionApiFixtures.sql"), "-v", "RunTag=" + randomUUID().replaceAll("-", ""), "-h", "-1", "-w", "65535"], { encoding: "utf8", windowsHide: true });
const fixture = JSON.parse(text.split(/\r?\n/).find(line => line.trim().startsWith("{")));
await writeFile(output, JSON.stringify({ ...previous, ...fixture }, null, 2));
console.log("Local demo fixture ready; existing financial history preserved. No schema or credential changes.");
