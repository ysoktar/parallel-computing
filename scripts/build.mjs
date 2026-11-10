// Build the static site into dist/ (a plain copy of site/: no dependencies, no bundling).
import { cpSync, rmSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const out = join(root, "dist");
rmSync(out, { recursive: true, force: true });
cpSync(join(root, "site"), out, { recursive: true });
// Cache busting: every deploy gets its own ?v=… on stylesheets, scripts and module imports, so browsers that cached an
// older copy (GitHub Pages serves with max-age=600) always load the new files instead of mixing old and new modules.
let version;
try { version = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch { version = String(Date.now()); }
const tag = (url) => `${url}?v=${version}`;
(function bust(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { bust(p); continue; }
    if (f.endsWith(".html")) {
      const t = readFileSync(p, "utf8").replace(/(src|href)="((?:\.\.\/)?(?:js|css)\/[^"?]+\.(?:js|css))"/g, (_, attr, url) => `${attr}="${tag(url)}"`);
      writeFileSync(p, t);
    } else if (f.endsWith(".js")) {
      const t = readFileSync(p, "utf8").replace(/(from\s*|import\(\s*)(["'])(\.{1,2}\/[^"'?]+\.js)\2/g, (_, pre, q, url) => `${pre}${q}${tag(url)}${q}`);
      writeFileSync(p, t);
    }
  }
})(out);
console.log(`cache-busting version: ${version}`);
let files = 0, bytes = 0;
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f), s = statSync(p);
    if (s.isDirectory()) walk(p); else { files++; bytes += s.size; }
  }
})(out);
console.log(`dist/: ${files} files, ${(bytes / 1024).toFixed(0)} KB`);
