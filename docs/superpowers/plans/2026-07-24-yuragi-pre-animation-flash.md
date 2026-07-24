# Yuragi Pre-Animation Flash Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a fully settled Yuragi SVG title from appearing during a
Swup fade-in before its settle animation starts.

**Architecture:** Keep the SVG host layout-active but `visibility: hidden`
until the page-transition gate opens. Arm Yuragi's Web Animations keyframes
first, then reveal the host on the next animation frame. A small scheduling
helper owns the animation-before-reveal ordering and exposes cleanup for
component fallback and unmount paths.

**Tech Stack:** Astro 5, Svelte 5, TypeScript, Node test runner,
`@yuragi-labs/core@0.2.0`, Web Animations API, Swup

## Global Constraints

- Work directly on branch `feat/yuragi-article-title`.
- Do not change the pinned Yuragi version or add dependencies.
- Preserve the SSR/no-JavaScript title, Pagefind metadata, and accessible text.
- Preserve the 300 ms monotonic animation budget and first-contentful-paint
  fallback policy.
- Preserve Swup opacity gating: the settle animation still starts only after
  the incoming container reaches opacity `1`.
- Treat the six existing `astro check` errors as baseline; add no new
  diagnostics.

---

### Task 1: Arm the settle animation before revealing its SVG

**Files:**
- Modify: `src/utils/yuragi-animation.ts`
- Modify: `src/components/YuragiTitle.svelte`
- Modify: `test/yuragi-animation.test.mjs`

**Interfaces:**
- Consumes:
  `runAfterPageTransition(run: () => void, gate: PageTransitionGate)`
- Produces:
  `runBeforeNextFrame(run: () => void, afterFrame: () => void, schedule?: FrameScheduler): () => void`
- Produces:
  `FrameScheduler = (run: () => void) => () => void`

- [ ] **Step 1: Write failing reveal-order tests**

Append to `test/yuragi-animation.test.mjs`:

```js
test("arms Yuragi animation before revealing it on the next frame", async () => {
  const { runBeforeNextFrame } = await loadTransitionGate();
  const events = [];
  let nextFrame;

  runBeforeNextFrame(
    () => events.push("animate"),
    () => events.push("reveal"),
    (run) => {
      nextFrame = run;
      return () => {};
    },
  );

  assert.deepEqual(events, ["animate"]);
  nextFrame();
  assert.deepEqual(events, ["animate", "reveal"]);
});

test("cancels a pending Yuragi reveal", async () => {
  const { runBeforeNextFrame } = await loadTransitionGate();
  const events = [];
  let nextFrame;
  let active = true;

  const cleanup = runBeforeNextFrame(
    () => events.push("animate"),
    () => events.push("reveal"),
    (run) => {
      nextFrame = () => {
        if (active) run();
      };
      return () => {
        active = false;
      };
    },
  );

  cleanup();
  nextFrame();
  assert.deepEqual(events, ["animate"]);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test test/yuragi-animation.test.mjs
```

Expected: the six existing tests pass and the two new tests fail with
`TypeError: runBeforeNextFrame is not a function`.

- [ ] **Step 3: Implement the next-frame ordering helper**

Add to `src/utils/yuragi-animation.ts`:

```ts
export type FrameScheduler = (run: () => void) => () => void;

const scheduleFrame: FrameScheduler = (run) => {
  const frame = requestAnimationFrame(run);
  return () => cancelAnimationFrame(frame);
};

export function runBeforeNextFrame(
  run: () => void,
  afterFrame: () => void,
  schedule: FrameScheduler = scheduleFrame,
) {
  run();
  return schedule(afterFrame);
}
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
node --test test/yuragi-animation.test.mjs
```

Expected: all eight animation tests pass.

- [ ] **Step 5: Keep the SVG hidden until Yuragi owns its first frame**

In `src/components/YuragiTitle.svelte`:

1. Import `runBeforeNextFrame`.
2. Add instance state:

```ts
let svgVisible = false;
```

3. Add lifecycle cleanup beside `cancelInitialSettle`:

```ts
let cancelPendingReveal = () => {};
```

4. In `selectFallback()`, cancel and reset the pending reveal before clearing
   the SVG:

```ts
cancelPendingReveal();
cancelPendingReveal = () => {};
svgVisible = false;
```

5. When the first pending SVG claims the animation budget, keep
   `svgVisible = false`. Responsive rebuilds before the transition gate opens
   therefore remain hidden through the shared host.

6. Replace the initial settle callback body with:

```ts
if (disposed || !currentSvg) return;
const svg = currentSvg;
cancelPendingReveal = runBeforeNextFrame(
  () => {
    void animateShards(svg, {
      type: "settle",
      stagger: "by-x",
    });
  },
  () => {
    if (!disposed) svgVisible = true;
  },
);
```

7. Cancel `cancelPendingReveal()` during component cleanup.

8. Bind a visibility class to the SVG host:

```svelte
<span
  bind:this={svgHost}
  class="svg-host"
  class:pending-reveal={!svgVisible}
  aria-hidden="true"
></span>
```

9. Preserve layout while hiding the completed paths:

```css
.pending-reveal {
  visibility: hidden;
}
```

- [ ] **Step 6: Run unit, format, build, and baseline type checks**

Run:

```bash
pnpm test:yuragi
pnpm exec biome check src/components/YuragiTitle.svelte \
  src/utils/yuragi-animation.ts test/yuragi-animation.test.mjs
pnpm build
pnpm check
git diff --check
```

Expected:

- Seven existing Yuragi tests plus two reveal-order tests pass.
- Biome, the production build, Pagefind, and `git diff --check` pass.
- `pnpm check` reports exactly the six known unrelated errors and no Yuragi
  diagnostic.

- [ ] **Step 7: Re-run the red-capable warm Swup browser probe**

Use a fresh Chrome profile and the production preview:

```bash
pnpm preview --host 0.0.0.0 --port 4321

task_chrome_dir=$(mktemp -d /tmp/lawvs-yuragi-flash-fixed.XXXXXX)
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --remote-debugging-port=9222 \
  --user-data-dir="$task_chrome_dir" \
  about:blank
```

In the CDP probe:

- Warm the module-level font promise on one article.
- Navigate through Swup to a second article.
- Patch `Element.prototype.animate` and poll every 2 ms.
- For each sample record container opacity, SVG visibility, shard opacity and
  transform, and shard-animation call count.
- Fail if the SVG host is visible while every shard is settled and the
  animation-call count is zero.

Expected:

- No visible sample contains a fully settled SVG before the first shard
  animation call.
- The first shard animation call occurs with container opacity `1`.
- The host becomes visible on the following animation frame.
- Cold font expiry still restores fallback text without installing a late SVG.

- [ ] **Step 8: Commit the implementation**

```bash
git add docs/superpowers/plans/2026-07-24-yuragi-pre-animation-flash.md \
  src/components/YuragiTitle.svelte src/utils/yuragi-animation.ts \
  test/yuragi-animation.test.mjs
git commit -m "fix: hide yuragi title until animation starts"
```
