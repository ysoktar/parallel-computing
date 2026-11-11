import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("free visual audit uses Playwright on GitHub Actions, not a paid browser provider",()=>{
  const workflow=file(".github/workflows/visual-audit.yml");
  const runner=file("scripts/visual-audit.mjs");
  assert.match(workflow,/actions\/upload-artifact@v4/);
  assert.match(workflow,/playwright/);
  assert.match(workflow,/visual-audit\.mjs/);
  assert.match(runner,/chromium\.launch/);
  assert.match(runner,/page\.screenshot/);
  assert.match(runner,/fullPage:\s*true/);
  assert.match(runner,/1440/);
  assert.match(runner,/390/);
  assert.match(runner,/sitePages/);
  assert.match(runner,/en\//);
  assert.match(runner,/scrollWidth/);
  assert.match(runner,/pageerror/);
  assert.match(runner,/mouse\.move|\.hover\(/);
  assert.match(runner,/\.click\(/);
});

test("each code-linked exercise explains hover, pin and keyboard use",()=>{
  const js=file("site/js/learning-widgets.js");
  assert.match(js,/learning-ux-hint/);
  assert.match(js,/aria-live/);
  assert.match(js,/aria-keyshortcuts/);
  assert.match(js,/ArrowRight/);
  assert.match(js,/ArrowLeft/);
  assert.match(js,/ArrowUp/);
  assert.match(js,/ArrowDown/);
  assert.match(js,/learning-scroll-hint/);
});

test("compact controls and grid cells remain usable as touch targets",()=>{
  const css=file("site/css/style.css");
  const suffix=css.slice(css.indexOf("/* Touch and keyboard usability for teaching widgets */"));
  assert.ok(suffix.length>500);
  assert.match(suffix,/\.learning-cell/);
  assert.match(suffix,/\.learning-axis/);
  assert.match(suffix,/\.learning-code-line/);
  assert.match(suffix,/\.learning-lane/);
  assert.match(suffix,/min-height:\s*36px/);
  assert.match(suffix,/min-height:\s*44px/);
});
