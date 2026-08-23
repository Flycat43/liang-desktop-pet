import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
const result = await build({
  entryPoints: [path.join(packageRoot, "src", "client.js")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "chrome120",
  write: false,
  legalComments: "none",
  loader: {
    ".webp": "dataurl"
  }
});

const bundledSource = result.outputFiles[0].text;
const clientModule = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundledSource.split("\n").map((line) => (line ? `    ${line}` : "")).join("\n")}
    return module.exports;
  }
});
`;

await fs.mkdir(path.join(packageRoot, "lib"), { recursive: true });
await fs.writeFile(path.join(packageRoot, "lib", "client.js"), clientModule);
console.log(`Built ${manifest.name} client bundle (${Buffer.byteLength(clientModule)} bytes).`);
