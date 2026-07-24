# Yuragi Dev WASM Loading Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Yuragi article-title runtime load its WASM asset and animate during Astro development without changing production behavior.

**Architecture:** Prevent Vite from flattening `@yuragi-labs/core/wasm` into its dependency cache, where the package-relative WASM URL points at a nonexistent file. Keep the package module unoptimized so Vite serves the real WASM asset from its source location.

**Tech Stack:** Astro 5, Vite, Svelte 5, Node test runner, `@yuragi-labs/core` 0.2.0

## Global Constraints

- Do not change `YuragiTitle.svelte`, the font, animation timing, public assets, or production runtime behavior.
- Keep the fix to the existing Astro Vite configuration and a focused regression test.
- The development WASM request must return `200`, and a warmed Swup navigation must install and animate the article-title SVG.
- Preserve the six known unrelated `astro check` errors without adding a Yuragi diagnostic.

---

### Task 1: Exclude the Yuragi WASM entry from Vite dependency optimization

**Files:**
- Modify: `astro.config.mjs`
- Modify: `test/yuragi-title.test.mjs`

**Interfaces:**
- Consumes: Astro's existing `vite` configuration and the package export `@yuragi-labs/core/wasm`
- Produces: `vite.optimizeDeps.exclude` containing the exact string `@yuragi-labs/core/wasm`

- [ ] **Step 1: Write the failing configuration regression test**

Add this test to `test/yuragi-title.test.mjs`:

```js
test("keeps the Yuragi WASM entry out of Vite dependency optimization", async () => {
	const config = await readFile(
		new URL("../astro.config.mjs", import.meta.url),
		"utf8",
	);

	assert.match(
		config,
		/optimizeDeps:\s*\{[\s\S]*?exclude:\s*\[[\s\S]*?["']@yuragi-labs\/core\/wasm["'][\s\S]*?\][\s\S]*?\}/,
	);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/yuragi-title.test.mjs
```

Expected: the new test fails because `astro.config.mjs` has no
`vite.optimizeDeps.exclude` entry.

- [ ] **Step 3: Add the minimal Vite configuration**

Add the exclusion alongside the existing `vite.build` settings:

```js
vite: {
  optimizeDeps: {
    exclude: ["@yuragi-labs/core/wasm"],
  },
  build: {
    // existing rollupOptions remain unchanged
  },
},
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test test/yuragi-title.test.mjs
```

Expected: both production-asset and optimization-exclusion tests pass.

- [ ] **Step 5: Verify the actual development runtime**

Restart the server with:

```bash
pnpm dev --host 0.0.0.0 --port 4321
```

Use the existing red-capable browser probe:

```bash
node .git/sdd/task-1-browser-probe.mjs
```

Expected:

- no request to `/node_modules/.vite/deps/yuragi_wasm_compiler.wasm`;
- the Yuragi WASM response is `200`;
- `forbiddenSampleCount` is `0`;
- `warmState.hasSvg` is `true`;
- the first animation call sees `hostVisibility: "hidden"`;
- cold expiry and late-font states both have `svgCount: 0`.

- [ ] **Step 6: Run the full verification set**

Run:

```bash
pnpm exec biome check astro.config.mjs test/yuragi-title.test.mjs
pnpm build
pnpm test:yuragi
pnpm check
git diff --check
```

Expected:

- Biome passes;
- Astro builds 44 pages and Pagefind indexes 38 pages;
- all Yuragi tests pass;
- `pnpm check` reports only the six known baseline errors;
- `git diff --check` emits no output.

- [ ] **Step 7: Commit**

```bash
git add astro.config.mjs test/yuragi-title.test.mjs
git commit -m "fix: load yuragi wasm in dev"
```
