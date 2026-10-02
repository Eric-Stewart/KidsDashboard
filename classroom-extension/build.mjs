import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("./", import.meta.url);
await mkdir(new URL("dist/", root), { recursive: true });
await build({
  entryPoints: ["background", "content", "popup"].map((name) =>
    fileURLToPath(new URL(`src/${name}.ts`, root)),
  ),
  outdir: fileURLToPath(new URL("dist/", root)),
  bundle: true,
  platform: "browser",
  target: "chrome114",
  format: "iife",
  legalComments: "none",
});
for (const name of ["manifest.json", "popup.html", "popup.css"])
  await copyFile(new URL(name, root), new URL(`dist/${name}`, root));
console.log("Load classroom-extension/dist as an unpacked Chrome extension.");
