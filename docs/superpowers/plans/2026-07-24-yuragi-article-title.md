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

### Task 4: Defer Swup-mounted title animation until the page is visible

**Files:**
- Create: `src/utils/yuragi-animation.ts`
- Create: `test/yuragi-animation.test.mjs`
- Modify: `src/components/YuragiTitle.svelte`
- Modify: `package.json`

**Interfaces:**
- Consumes: the `#swup-container` computed opacity and `transitionend` event,
  plus the most recently rendered Yuragi SVG
- Produces: `runAfterPageTransition(run, gate)`, which returns a cleanup
  callback and either runs immediately or after the current transition

- [ ] **Step 1: Write the failing transition-gate test**

Create `test/yuragi-animation.test.mjs`. Load the TypeScript helper through
`typescript.transpileModule`, asserting clearly when the helper does not exist,
then verify both scheduling branches:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadTransitionGate() {
  const source = await readFile(
    new URL("../src/utils/yuragi-animation.ts", import.meta.url),
    "utf8",
  ).catch(() => "");
  assert.notEqual(source, "", "expected the Yuragi transition gate");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("defers Yuragi animation until the active page transition ends", async () => {
  const { runAfterPageTransition } = await loadTransitionGate();
  let deferredRun;
  let runs = 0;
  let cleanups = 0;

  const cleanup = runAfterPageTransition(
    () => {
      runs += 1;
    },
    {
      isTransitioning: () => true,
      onTransitionEnd: (run) => {
        deferredRun = run;
        return () => {
          cleanups += 1;
        };
      },
    },
  );

  assert.equal(runs, 0);
  deferredRun();
  assert.equal(runs, 1);
  cleanup();
  assert.equal(cleanups, 1);
});

test("runs Yuragi animation immediately outside a page transition", async () => {
  const { runAfterPageTransition } = await loadTransitionGate();
  let runs = 0;
  let subscriptions = 0;

  const cleanup = runAfterPageTransition(
    () => {
      runs += 1;
    },
    {
      isTransitioning: () => false,
      onTransitionEnd: () => {
        subscriptions += 1;
        return () => {};
      },
    },
  );

  assert.equal(runs, 1);
  assert.equal(subscriptions, 0);
  cleanup();
});
```

Update `test:yuragi` to run both Yuragi test files:

```json
"test:yuragi": "node --test test/yuragi-title.test.mjs test/yuragi-animation.test.mjs"
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm test:yuragi
```

Expected: the generated-site test passes and both transition-gate tests fail
with `expected the Yuragi transition gate`.

- [ ] **Step 3: Add the minimal transition gate**

Create `src/utils/yuragi-animation.ts`:

```ts
export interface PageTransitionGate {
  isTransitioning: () => boolean;
  onTransitionEnd: (run: () => void) => () => void;
}

const noop = () => {};

export function runAfterPageTransition(
  run: () => void,
  gate: PageTransitionGate,
) {
  if (!gate.isTransitioning()) {
    run();
    return noop;
  }

  return gate.onTransitionEnd(run);
}
```

In `YuragiTitle.svelte`, retain the latest generated SVG. Schedule the first
settle animation through `runAfterPageTransition`. Detect an active transition
from the incoming `#swup-container` opacity and wait for its opacity
`transitionend`; remove that listener during component cleanup.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
pnpm test:yuragi
```

Expected: all three tests pass.

- [ ] **Step 5: Verify the real Swup navigation**

Run the headless Chrome navigation harness against the production preview.
Expected: full-load animation begins with container opacity `1`; after Swup
navigation, the first title animation call occurs only after the incoming
container's opacity transition ends, also with container opacity `1`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm exec biome check src/utils/yuragi-animation.ts \
  src/components/YuragiTitle.svelte test/yuragi-animation.test.mjs
pnpm build
pnpm check
```

Expected: Biome and build pass; `pnpm check` reports exactly the six baseline
errors and no Yuragi diagnostics.

Commit:

```bash
git add docs package.json src/components/YuragiTitle.svelte \
  src/utils/yuragi-animation.ts test/yuragi-animation.test.mjs
git commit -m "fix: replay yuragi title animation after swup"
```
