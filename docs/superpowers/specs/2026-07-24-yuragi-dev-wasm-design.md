# Yuragi Dev WASM Loading Fix

## Context

The article-title integration works in the production build, but Astro's Vite
development server pre-bundles `@yuragi-labs/core/wasm`. The pre-bundled
module keeps this relative asset expression:

```js
new URL("./yuragi_wasm_compiler.wasm", import.meta.url)
```

It therefore requests
`/node_modules/.vite/deps/yuragi_wasm_compiler.wasm`, which the development
server does not emit and returns as `404 text/html`. `createYuragiFont()` fails
before requesting the font, so the title correctly falls back to text but can
never install or animate an SVG in development.

The production build emits a hashed Yuragi WASM asset and is not affected.

## Design

Add `@yuragi-labs/core/wasm` to `vite.optimizeDeps.exclude` in
`astro.config.mjs`.

Vite will then transform the package's source module instead of flattening it
into `.vite/deps`. The relative WASM URL stays associated with the package
module and Vite can serve the actual asset during development.

No component behavior, public asset copying, Yuragi runtime API, font choice,
animation timing, or production bundling will change.

## Alternatives Rejected

- Passing an explicit package-internal WASM URL from `YuragiTitle.svelte`
  would couple the blog to Yuragi's internal file layout.
- Copying the WASM binary into `public/` would duplicate dependency assets and
  increase the fork's maintenance surface.
- Clearing the Vite cache is insufficient because a forced dependency
  re-optimization reproduced the same missing URL.

## Failure Handling

The existing fallback remains unchanged: if WASM or font loading fails, the
ordinary SSR title stays visible and no late animation starts.

## Verification

- Add a regression check that the Astro Vite config excludes
  `@yuragi-labs/core/wasm` from dependency optimization.
- Restart a fresh Astro development server and use a headless browser to prove:
  - the Yuragi WASM request returns `200`, not `404`;
  - the font request begins after the runtime loads;
  - a warmed Swup article navigation installs an SVG and plays the animation.
- Re-run the Yuragi test suite, Biome, production build/Pagefind, and the known
  type-check baseline.
