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
5. The component measures its available width, builds an SVG, and hides only
   the visual fallback after the SVG is ready.
6. `ResizeObserver` rebuilds layout from the cached outline when the title
   width changes; it does not recompile the font.
7. Swup-created article islands reuse browser and module caches. Because that
   makes compilation nearly immediate, an island mounted while Swup's
   `is-changing` class is active defers its initial settle animation until the
   `swup:visit:end` DOM event. A normal page load animates immediately.
8. The deferred callback reads the latest SVG produced by `ResizeObserver` and
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
does not block article navigation or rendering.

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
