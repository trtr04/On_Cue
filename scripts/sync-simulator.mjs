import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const root = join(import.meta.dirname, "..");
const outDir = join(root, "public", "simulator");
const assetSrc = join(root, "public", "assets");
const assetDest = join(outDir, "assets");

mkdirSync(assetDest, { recursive: true });
cpSync(assetSrc, assetDest, { recursive: true });

let html = readFileSync(join(root, "index.html"), "utf8");
let css = readFileSync(join(root, "styles.css"), "utf8");
let js = readFileSync(join(root, "app.js"), "utf8");

css = css.replace(/@import "@fontsource\/[^"]+";\s*/g, "");
css = css.replace(
  'font-family: "Noto Sans SC", sans-serif;',
  'font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;',
);

html = html
  .replace('href="/styles.css"', 'href="./styles.css"')
  .replace('src="/app.js"', 'src="./app.js"')
  .replaceAll('src="/assets/', 'src="./assets/');
js = js.replaceAll('"/assets/', '"./assets/');

writeFileSync(join(outDir, "index.html"), html);
writeFileSync(join(outDir, "styles.css"), css);
writeFileSync(join(outDir, "app.js"), js);

const mime = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function dataUri(fileName) {
  const filePath = join(assetSrc, fileName);
  const ext = extname(fileName).toLowerCase();
  const buf = readFileSync(filePath);
  if (ext === ".svg") {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buf.toString("utf8"))}`;
  }
  return `data:${mime[ext] || "application/octet-stream"};base64,${buf.toString("base64")}`;
}

const files = readdirSync(assetSrc);
let bundledHtml = html;
let bundledJs = js;
for (const fileName of files) {
  const uri = dataUri(fileName);
  bundledHtml = bundledHtml.replaceAll(`./assets/${fileName}`, uri);
  bundledJs = bundledJs.replaceAll(`./assets/${fileName}`, uri);
}

bundledHtml = bundledHtml
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="./app.js"></script>', `<script type="module">\n${bundledJs}\n</script>`);

writeFileSync(join(root, "nativeHtml.js"), `const html = ${JSON.stringify(bundledHtml)};\nexport default html;\n`);
console.log("synced public/simulator and nativeHtml.js");
