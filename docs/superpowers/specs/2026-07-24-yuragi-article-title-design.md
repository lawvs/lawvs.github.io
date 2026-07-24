# Yuragi Article Title Design

## Goal

Render article-detail titles with Yuragi's runtime WASM effect while keeping
the Fuwari fork close to upstream. Home-page cards, archive titles, metadata,
RSS, and article content remain unchanged.

## Constraints

- Work on branch `feat/yuragi-article-title`.
- Reuse the blog's existing Astro and Svelte integration; do not add React.
- Use `@yuragi-labs/core@0.2.0` and its runtime WASM compiler.
- Preserve the current sans-serif, bold title treatment rather than matching
  each operating system's CJK fallback exactly.
- Keep the original title in server-rendered HTML for first paint, Pagefind,
  accessibility, and no-JavaScript operation.
- Treat the six existing `astro check` errors as baseline; do not fix them or
  add new diagnostics.
- A failed font or WASM load must leave the original title visible.
- A cold title enhancement gets a 300 ms budget after hydration. If no
  renderable SVG is ready by then, keep the original title for that visit and
  do not replace it later.

## Architecture

`YuragiTitle.svelte` is the only blog adapter at the Yuragi seam. It accepts a
single `text` prop, renders that text during SSR, and upgrades the visual layer
after hydration. The adapter loads one shared `YuragiFont` promise, compiles
the current title, lays it out at the host width, creates the SVG, and runs the
settle animation.

The adapter uses the static Source Han Sans CN Bold OTF from Adobe's pinned
`a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2` revision:

`https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/CN/SourceHanSansCN-Bold.otf`

The 8,569,308-byte font remains remote to avoid adding a large binary to the
fork. The URL is content-addressed by Git revision and allows cross-origin
fetches. The existing text remains the fallback if that external fetch fails.

## Rendering Flow

1. Astro renders the article page and the Svelte component's normal text.
2. `client:load` hydrates the title without blocking the rest of the page.
3. A module-level promise loads the 611,458-byte WASM asset and the font once.
4. Yuragi compiles the article title into an outline.
5. Hydration starts a 300 ms animation budget and makes the fallback visually
   transparent while preserving its layout and accessible text.
6. If compilation and SVG creation finish inside that budget, the component
   claims the budget, installs the SVG, and hides the fallback semantically.
   If the budget expires first, the fallback becomes visible again and that
   island ignores the late compile result.
7. The remote font request is not canceled on expiry, so later article
   navigations can reuse the warmed module-level font promise.
8. `ResizeObserver` rebuilds layout from the cached outline when the title
   width changes; it does not recompile the font.
9. Swup-created article islands reuse browser and module caches. Because that
   makes compilation nearly immediate, an island mounted while the incoming
   `#swup-container` has computed opacity below `1` defers its initial settle
   animation until that container's opacity transition ends. A normal page
   load animates immediately.
10. The deferred callback reads the latest SVG produced by `ResizeObserver` and
   is removed if the component unmounts before the visit ends.

Mobile uses a 30px title size and desktop (`min-width: 768px`) uses 36px,
matching the existing Tailwind classes. The SVG inherits the existing
light/dark `currentColor`.

## Accessibility and Search

The title string remains in the SSR output with the existing Pagefind
attributes. Once upgraded, the SVG is `aria-hidden`; the visually hidden
fallback remains in the accessibility tree as the title text. Reduced-motion
preferences are honored by Yuragi's animation helper.

## Error Handling

Font loading, WASM loading, title compilation, and SVG creation are all
progressive enhancement. Any rejection leaves the fallback text visible and
does not block article navigation or rendering. Expiring the 300 ms budget is
not an error: it selects the stable fallback for that island and prevents a
late full-title-to-animation reversal.

## Verification

- A build-artifact test verifies a representative article contains the
  fallback title and the Yuragi host marker.
- The production build must emit a Yuragi WASM asset and complete Pagefind.
- `astro check` must report the same six baseline errors and no Yuragi
  diagnostics.
- A runtime smoke test compiles a mixed Chinese/Latin title with the selected
  font and packaged WASM.
- A transition-gate unit test verifies that normal loads animate immediately
  and Swup-mounted titles wait for the visit to finish.
- A browser navigation smoke test verifies that the settle animation starts
  after the Swup container becomes visible.
- Animation-budget unit tests verify that a fast result can claim the budget,
  while expiry restores the fallback and rejects a late claim.
- A cold-browser smoke test verifies that a delayed font never replaces a
  fallback after the 300 ms budget.
