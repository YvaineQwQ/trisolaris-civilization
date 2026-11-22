import fs from "node:fs/promises";
import path from "node:path";
const outDir = "three-body-civilization/public/fonts";
await fs.mkdir(outDir, { recursive: true });
const families = [
  ["Archivo", "Archivo:wdth,wght@62..125,100..900", "archivo"],
  ["Outfit", "Outfit:wght@100..900", "outfit"],
  ["Space Grotesk", "Space+Grotesk:wght@300..700", "space-grotesk"],
  ["JetBrains Mono", "JetBrains+Mono:wght@100..800", "jetbrains-mono"],
];
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
let cssOut = "/* Bundled Google Fonts (SIL OFL) — fetched 2026-11 for TRISOLARIS v1.6. */\n";
for (const [name, query, slug] of families) {
  const url = "https://fonts.googleapis.com/css2?family=" + query + "&display=swap";
  const res = await fetch(url, { headers: { "User-Agent": ua } });
  if (!res.ok) throw new Error(name + " css " + res.status);
  let css = await res.text();
  const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
  const seen = new Set();
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    const ext = ".woff2";
    const file = slug + "-" + seen.size + ext;
    const bin = await fetch(u, { headers: { "User-Agent": ua } });
    if (!bin.ok) throw new Error(name + " font " + bin.status);
    await fs.writeFile(path.join(outDir, file), Buffer.from(await bin.arrayBuffer()));
    css = css.split(u).join("/fonts/" + file);
  }
  cssOut += "/* " + name + " */\n" + css + "\n";
  console.log(name, seen.size, "files");
}
await fs.writeFile("three-body-civilization/public/fonts/fonts.css", cssOut);
console.log("done");
