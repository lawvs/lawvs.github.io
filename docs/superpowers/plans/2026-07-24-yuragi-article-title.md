# Yuragi Article Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade article-detail titles to Yuragi runtime WASM while preserving the existing server-rendered title as a resilient fallback.

**Architecture:** Add one Svelte adapter whose SSR surface is normal title text and whose browser implementation lazily loads a shared Yuragi font, compiles the title, and renders a responsive SVG. Wire that adapter into only the article-detail page and verify behavior at the generated-site seam.

**Tech Stack:** Astro 5, Svelte 5, TypeScript, Node test runner, `@yuragi-labs/core@0.2.0`

## Global Constraints

- Work on branch `feat/yuragi-article-title`.
- Do not add React or modify home-page cards, archives, metadata, RSS, or content.
- Keep normal title text in SSR output and visible on every runtime failure.
- Use Source Han Sans CN Bold from pinned Adobe revision `a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2`.
- Do not change the six existing `astro check` errors; add no Yuragi diagnostics.
- Run implementation inline; do not dispatch subagents.

---

### Task 1: Add the generated-site regression seam

**Files:**
- Create: `test/yuragi-title.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: production output at `dist/posts/2024/blog-migration/index.html`
- Produces: `pnpm test:yuragi`, which verifies SSR fallback text, the Yuragi host marker, and a packaged WASM asset

- [ ] **Step 1: Write the failing generated-site test**

```js
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

test("article title keeps fallback text and includes the Yuragi runtime", async () => {
  const html = await readFile(
    new URL("../dist/posts/2024/blog-migration/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /data-yuragi-title/);
  assert.match(html, /博客构建历程：从 Hexo 到 Astro/);

  const assets = await readdir(
    new URL("../dist/_astro/", import.meta.url),
  );
  const wasm = assets.find((asset) => asset.endsWith(".wasm"));
  assert.ok(wasm, "expected a packaged Yuragi WASM asset");
  assert.ok(
    (await stat(new URL(`../dist/_astro/${wasm}`, import.meta.url))).size > 0,
  );
});
```

Add the package script:

```json
"test:yuragi": "node --test test/yuragi-title.test.mjs"
```

- [ ] **Step 2: Run the existing build and verify RED**

Run:

```bash
pnpm build && pnpm test:yuragi
```

Expected: the test fails at `assert.match(html, /data-yuragi-title/)`.

### Task 2: Implement the Svelte runtime adapter

**Files:**
- Create: `src/components/YuragiTitle.svelte`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `text: string`; `@yuragi-labs/core` layout, SVG, animation, and WASM interfaces
- Produces: an SSR-safe Svelte component with `data-yuragi-title` and progressive runtime enhancement

- [ ] **Step 1: Install the runtime dependency**

Run:

```bash
pnpm add @yuragi-labs/core@0.2.0
```

Expected: `package.json` and `pnpm-lock.yaml` contain version `0.2.0`.

- [ ] **Step 2: Implement the adapter**

```svelte
<script context="module" lang="ts">
import { createYuragiFont, type YuragiFont } from "@yuragi-labs/core/wasm";

const FONT_URL =
  "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/CN/SourceHanSansCN-Bold.otf";

let fontPromise: Promise<YuragiFont> | undefined;

function getFont() {
  fontPromise ??= createYuragiFont({ font: FONT_URL });
  return fontPromise;
}
</script>

<script lang="ts">
import {
  animateShards,
  createShardedSvg,
  layoutShardedText,
  type TextOutline,
} from "@yuragi-labs/core";
import "@yuragi-labs/core/style.css";
import { onMount } from "svelte";

export let text: string;

let svgHost: HTMLSpanElement;
let ready = false;

onMount(() => {
  let disposed = false;
  let outline: TextOutline | undefined;
  let frame: number | undefined;
  let hasRendered = false;
  const media = window.matchMedia("(min-width: 768px)");

  function render() {
    if (!outline || disposed) return;
    const maxWidth = svgHost.clientWidth;
    if (maxWidth <= 0) return;
    const layout = layoutShardedText(outline, {
      size: media.matches ? 36 : 30,
      maxWidth,
    });
    const svg = createShardedSvg(layout, { hover: "outline" });
    svg.setAttribute("aria-hidden", "true");
    svgHost.replaceChildren(svg);
    ready = true;

    if (!hasRendered) {
      hasRendered = true;
      void animateShards(svg, {
        type: "settle",
        stagger: "by-x",
      });
    }
  }

  function scheduleRender() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  }

  const observer = new ResizeObserver(scheduleRender);
  observer.observe(svgHost);
  media.addEventListener("change", scheduleRender);

  void getFont()
    .then((font) => font.compile(text))
    .then((compiled) => {
      if (disposed) return;
      outline = compiled;
      render();
    })
    .catch(() => undefined);

  return () => {
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    observer.disconnect();
    media.removeEventListener("change", scheduleRender);
  };
});
</script>

<span
  class="transition w-full block font-bold mb-3 text-3xl md:text-[2.25rem]/[2.75rem]
    text-black/90 dark:text-white/90 md:before:w-1 before:h-5 before:rounded-md
    before:bg-[var(--primary)] before:absolute before:top-[0.75rem] before:left-[-1.125rem]"
  data-pagefind-body
  data-pagefind-weight="10"
  data-pagefind-meta="title"
  data-yuragi-title
  aria-label={text}
>
  <span class:visually-hidden={ready} aria-hidden={ready}>{text}</span>
  <span bind:this={svgHost} class="svg-host" aria-hidden="true"></span>
</span>

<style>
.svg-host {
  display: block;
  width: 100%;
}

.svg-host :global(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
```

This keeps fallback text visible until the SVG exists, retains accessible text,
and rebuilds only the layout in `ResizeObserver`.

### Task 3: Wire the article page and make the tracer bullet green

**Files:**
- Modify: `src/pages/posts/[...slug].astro:72-84`

**Interfaces:**
- Consumes: `YuragiTitle` and `entry.data.title`
- Produces: article-detail SSR HTML containing the fallback title and a hydrated Yuragi island

- [ ] **Step 1: Replace only the visual title block**

Import:

```astro
import YuragiTitle from "@components/YuragiTitle.svelte";
```

Keep the existing outer animation wrapper and render:

```astro
<YuragiTitle
  text={entry.data.title}
  client:load
/>
```

The component owns the existing title classes and Pagefind attributes.

- [ ] **Step 2: Build and verify GREEN**

Run:

```bash
pnpm build && pnpm test:yuragi
```

Expected: one Node test passes; Astro builds 44 pages; Pagefind indexes the
article pages.

- [ ] **Step 3: Compare typecheck against baseline**

Run:

```bash
pnpm check
```

Expected: exit 1 with the same six pre-existing errors and no diagnostic in
`YuragiTitle.svelte`.

- [ ] **Step 4: Run a mixed-title runtime smoke test**

Load the emitted WASM and pinned font in Node through
`createYuragiFont`, compile `博客构建历程：从 Hexo 到 Astro`, and assert the
outline contains 21 glyphs and at least one shard.

- [ ] **Step 5: Commit**

```bash
git add docs package.json pnpm-lock.yaml test src/components/YuragiTitle.svelte \
  'src/pages/posts/[...slug].astro'
git commit -m "feat: animate article titles with yuragi"
```
