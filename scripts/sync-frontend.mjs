import { copyFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const frontendOutput = path.join(projectRoot, "frontend-dist");
const publicDirectory = path.join(projectRoot, "public");
const mouseGameSource = path.join(projectRoot, "mouse-tumbler");
const knowledgeSource = path.join(
  projectRoot,
  "classic-training",
  "zenmeban-dialogue-advisor",
  "references",
  "knowledge",
);

await mkdir(path.join(publicDirectory, "assets"), { recursive: true });
await mkdir(path.join(publicDirectory, "knowledge"), { recursive: true });
await copyFile(path.join(frontendOutput, "index.html"), path.join(publicDirectory, "oncue.html"));
await cp(path.join(frontendOutput, "assets"), path.join(publicDirectory, "assets"), {
  recursive: true,
  force: true,
});
await cp(mouseGameSource, path.join(publicDirectory, "mouse-tumbler"), {
  recursive: true,
  force: true,
});
await Promise.all(
  ["scenes.json", "patterns.json", "strategies.json"].map((name) =>
    copyFile(path.join(knowledgeSource, name), path.join(publicDirectory, "knowledge", name)),
  ),
);
