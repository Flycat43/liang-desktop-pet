import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFile(path.join(packageRoot, relativePath), "utf8");

const manifest = JSON.parse(await read("package.json"));
const patchPath = manifest.dsh?.bundle?.patch;

assert.equal(typeof patchPath, "string", "package.json must declare dsh.bundle.patch");
assert.equal(manifest.dsh?.client?.platform, "web", "client platform must be web");
assert.ok(Array.isArray(manifest.dsh.client.inject), "client inject must be an array");
assert.ok(
  manifest.dsh.client.inject.includes("@deepseek-ai/dsh-client-runtime"),
  "client must inject the DSH runtime"
);
assert.ok(
  manifest.dsh.client.inject.includes("@deepseek-ai/dsh-client-ui-conversation"),
  "client must inject the conversation UI service"
);

const normalizedPatchPath = patchPath.replace(/^\.\//, "");
const patch = parse(await read(normalizedPatchPath));
assert.ok(Array.isArray(patch), "Cordis patch must contain a list of operations");
const insertedPlugins = patch.flatMap((entry) => entry?.insert ?? []);
const pluginEntry = insertedPlugins.find((entry) => entry?.name === manifest.name);

assert.ok(pluginEntry, `Cordis patch must insert ${manifest.name}`);
assert.equal(pluginEntry.id, manifest.name, "Cordis patch id must match the package name");

const packageFiles = new Set(manifest.files);
for (const requiredFile of [
  "lib/index.js",
  "lib/client.js",
  "README.md",
  "MANUAL.zh-CN.md",
  "ASSETS_LICENSE.md",
  normalizedPatchPath
]) {
  assert.ok(packageFiles.has(requiredFile), `${requiredFile} must be included in npm files`);
  await fs.access(path.join(packageRoot, requiredFile));
}

for (const exportTarget of Object.values(manifest.exports)) {
  const relativeTarget = exportTarget.replace(/^\.\//, "");
  await fs.access(path.join(packageRoot, relativeTarget));
}

const clientBundle = await read("lib/client.js");
assert.match(clientBundle, /window\.__ModuleLoader__\.load\(/, "client bundle must use the DSH module loader");
assert.match(clientBundle, new RegExp(`id: ["']${manifest.name}["']`), "client bundle id must match package name");
assert.equal(
  (clientBundle.match(/data:image\/webp;base64,/g) ?? []).length,
  6,
  "client bundle must contain all six character images"
);
assert.doesNotMatch(clientBundle, /\/Users\/|[A-Za-z]:\\Users\\/, "client bundle must not contain local home paths");

console.log(`Verified ${manifest.name}@${manifest.version}: manifest, patch, exports and six character assets.`);
