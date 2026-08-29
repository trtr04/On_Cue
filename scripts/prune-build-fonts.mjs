import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const assetsDirectory = path.join(process.cwd(), "dist", "client", "assets");
const entries = await readdir(assetsDirectory, { withFileTypes: true });
await Promise.all(
  entries
    .filter((entry) => entry.isFile() && /\.woff2?$/.test(entry.name))
    .map((entry) => rm(path.join(assetsDirectory, entry.name))),
);
