import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL(
	"../src/components/YuragiTitle.astro",
	import.meta.url,
);

test("article title keeps scoped fallback text and packages the Yuragi compiler", async () => {
	const html = await readFile(
		new URL("../dist/posts/2024/blog-migration/index.html", import.meta.url),
		"utf8",
	);

	const fallback = html.match(
		/<span\b[^>]*data-yuragi-title[^>]*>\s*<span\b[^>]*class="[^"]*\bfallback-text\b[^"]*"[^>]*>([^<]*)<\/span>/,
	);
	assert.ok(fallback, "expected fallback text inside the Yuragi title host");
	assert.equal(fallback[1], "博客构建历程：从 Hexo 到 Astro");

	const assetDirectory = new URL("../dist/_astro/", import.meta.url);
	const assets = await readdir(assetDirectory);
	const wasm = assets.find((asset) =>
		/^yuragi_wasm_compiler\..+\.wasm$/.test(asset),
	);

	assert.ok(wasm, "expected a packaged Yuragi compiler WASM asset");
	assert.ok((await stat(new URL(wasm, assetDirectory))).size > 0);
	assert.doesNotMatch(html, /component-url="[^"]*YuragiTitle/);
});

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

test("article title avoids Svelte island hydration", async () => {
	const page = await readFile(
		new URL("../src/pages/posts/[...slug].astro", import.meta.url),
		"utf8",
	);

	assert.match(page, /YuragiTitle\.astro/);
	assert.doesNotMatch(page, /YuragiTitle\.svelte/);
	assert.doesNotMatch(page, /<YuragiTitle[^>]*client:load/);
});

test("article title uses the unified Yuragi renderer without exit animation", async () => {
	const component = await readFile(componentPath, "utf8");

	assert.match(component, /\brenderYuragiText\b/);
	assert.match(component, /\bYuragiTextHandle\b/);
	assert.match(component, /\.play\(\)/);
	assert.doesNotMatch(component, /animation:out:start/);
	assert.doesNotMatch(component, /\bswup\?\.hooks\?\.on/);
	assert.doesNotMatch(component, /document\.addEventListener\(\s*["']swup:enable["']/);
	assert.doesNotMatch(component, /\.remove\(\)/);
	assert.doesNotMatch(component, /class:pending=\{enhancementState === "pending"\}/);
	assert.doesNotMatch(component, /\.pending\s*\{[\s\S]*?opacity:\s*0/);
	assert.doesNotMatch(component, /yuragi-animation/);
	assert.doesNotMatch(component, /\b(?:createAnimationBudget|waitForOpaqueTransition)\b/);
	assert.doesNotMatch(component, /\b(?:ANIMATION_BUDGET_MS|PAGE_TRANSITION_GATE_TIMEOUT_MS)\b/);
	assert.doesNotMatch(
		component,
		/\b(?:animateShards|createShardedSvg|layoutShardedText)\b/,
	);
});

test("article title reuses the prewarmed Yuragi font cache", async () => {
	const component = await readFile(componentPath, "utf8");
	const layout = await readFile(
		new URL("../src/layouts/Layout.astro", import.meta.url),
		"utf8",
	);

	assert.match(component, /\bgetCachedYuragiTitleFont\b/);
	assert.match(component, /\bloadYuragiTitleFont\b/);
	assert.match(
		component,
		/if\s*\(\s*cachedFont\s*\)\s*\{[\s\S]*?compileAndRender\(cachedFont\);[\s\S]*?\}\s*else\s*\{/,
	);
	assert.match(layout, /\bwarmYuragiTitleFont\b/);
	assert.doesNotMatch(component, /\bsvgReady\b/);
});

test("article title does not rely on Svelte-scoped dynamic classes to hide fallback text", async () => {
	const component = await readFile(componentPath, "utf8");

	assert.match(component, /fallbackElement\.hidden\s*=\s*true/);
	assert.match(component, /fallbackElement\.hidden\s*=\s*false/);
	assert.match(component, /svgElement\.style\.visibility\s*=\s*["']hidden["']/);
	assert.match(component, /svgElement\.style\.visibility\s*=\s*["']["']/);
	assert.doesNotMatch(component, /classList\.(?:add|remove)\(["']visually-hidden["']\)/);
	assert.doesNotMatch(component, /\.visually-hidden\s*\{/);
	assert.doesNotMatch(component, /pending-reveal/);
});

test("article title hides fallback before the first Swup-rendered frame", async () => {
	const component = await readFile(componentPath, "utf8");
	const transitionCss = await readFile(
		new URL("../src/styles/transition.css", import.meta.url),
		"utf8",
	);

	assert.match(
		transitionCss,
		/html\.is-changing\s+\[data-yuragi-title\]\s+\.fallback-text\s*\{[\s\S]*?visibility:\s*hidden/,
	);
	assert.doesNotMatch(component, /shouldAnimateOnReady/);
});

test("article title hides fallback as soon as an animated SVG is prepared", async () => {
	const component = await readFile(componentPath, "utf8");

	assert.match(
		component,
		/showSvg\(\);\s*if\s*\(\s*shouldAnimate\s*\)\s*playEnterWhenOpaque\(titleHandle\);/,
	);
	assert.doesNotMatch(
		component,
		/function playEnterWhenOpaque[\s\S]*?showSvg\(\);[\s\S]*?playingHandle\.play\(\);[\s\S]*?\}/,
	);
});

test("article title does not supersede a prepared enter animation on same-size resize", async () => {
	const component = await readFile(componentPath, "utf8");

	assert.match(component, /let lastRenderedWidth:\s*number\s*\|\s*undefined/);
	assert.match(component, /let lastRenderedSize:\s*number\s*\|\s*undefined/);
	assert.match(
		component,
		/if\s*\([\s\S]*?titleHandle\s*&&[\s\S]*?lastRenderedWidth\s*===\s*maxWidth\s*&&[\s\S]*?lastRenderedSize\s*===\s*size[\s\S]*?\)\s*\{\s*return;\s*\}/,
	);
});

test("article title does not stack the generic page-load animation on top of Yuragi", async () => {
	const page = await readFile(
		new URL("../src/pages/posts/[...slug].astro", import.meta.url),
		"utf8",
	);

	assert.match(page, /<!-- title -->\s*<div class="relative">\s*<YuragiTitle/);
	assert.doesNotMatch(
		page,
		/<!-- title -->\s*<div class="relative onload-animation">\s*<YuragiTitle/,
	);
});
