import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL(
	"../src/components/YuragiTitle.astro",
	import.meta.url,
);

async function readComponent() {
	return readFile(componentPath, "utf8");
}

test("built article keeps fallback text and bundles the Yuragi compiler", async () => {
	const html = await readFile(
		new URL("../dist/posts/2024/blog-migration/index.html", import.meta.url),
		"utf8",
	);

	const fallback = html.match(
		/<span\b[^>]*data-yuragi-title[^>]*>\s*<span\b[^>]*class="[^"]*\bfallback-text\b[^"]*"[^>]*>([^<]*)<\/span>/,
	);
	assert.ok(fallback, "expected fallback text inside the Yuragi title host");
	assert.equal(fallback[1], "博客构建历程：从 Hexo 到 Astro");
	assert.doesNotMatch(html, /component-url="[^"]*YuragiTitle/);

	const assetDirectory = new URL("../dist/_astro/", import.meta.url);
	const wasm = (await readdir(assetDirectory)).find((asset) =>
		/^yuragi_wasm_compiler\..+\.wasm$/.test(asset),
	);

	assert.ok(wasm, "expected a packaged Yuragi compiler WASM asset");
	assert.ok((await stat(new URL(wasm, assetDirectory))).size > 0);
});

test("article route uses the Astro title enhancer without generic page-load animation", async () => {
	const page = await readFile(
		new URL("../src/pages/posts/[...slug].astro", import.meta.url),
		"utf8",
	);

	assert.match(page, /YuragiTitle\.astro/);
	assert.match(page, /<!-- title -->\s*<div class="relative">\s*<YuragiTitle/);
	assert.doesNotMatch(page, /YuragiTitle\.svelte/);
	assert.doesNotMatch(page, /<YuragiTitle[^>]*client:load/);
	assert.doesNotMatch(
		page,
		/<!-- title -->\s*<div class="relative onload-animation">\s*<YuragiTitle/,
	);
});

test("title enhancer uses the current Yuragi renderer and shared font cache", async () => {
	const component = await readComponent();
	const layout = await readFile(
		new URL("../src/layouts/Layout.astro", import.meta.url),
		"utf8",
	);

	assert.match(component, /\brenderYuragiText\b/);
	assert.match(component, /\bYuragiTextHandle\b/);
	assert.match(component, /\bgetCachedYuragiTitleFont\b/);
	assert.match(component, /\bloadYuragiTitleFont\b/);
	assert.match(layout, /\bwarmYuragiTitleFont\b/);
});

test("title enhancer avoids known flicker and lost-animation regressions", async () => {
	const component = await readComponent();
	const transitionCss = await readFile(
		new URL("../src/styles/transition.css", import.meta.url),
		"utf8",
	);

	assert.match(
		transitionCss,
		/html\.is-changing\s+\[data-yuragi-title\]\s+\.fallback-text\s*\{[\s\S]*?visibility:\s*hidden/,
	);
	assert.match(component, /showSvg\(\);\s*if\s*\(\s*shouldAnimate\s*\)/);
	assert.match(component, /lastRenderedWidth\s*===\s*maxWidth/);
	assert.match(component, /lastRenderedSize\s*===\s*size/);
	assert.doesNotMatch(component, /shouldAnimateOnReady/);
});

test("legacy title animation paths stay removed", async () => {
	const component = await readComponent();
	const config = await readFile(
		new URL("../astro.config.mjs", import.meta.url),
		"utf8",
	);

	assert.match(
		config,
		/optimizeDeps:\s*\{[\s\S]*?exclude:\s*\[[\s\S]*?["']@yuragi-labs\/core\/wasm["'][\s\S]*?\][\s\S]*?\}/,
	);
	assert.doesNotMatch(component, /yuragi-animation/);
	assert.doesNotMatch(component, /animation:out:start/);
	assert.doesNotMatch(component, /\bswup\?\.hooks\?\.on/);
	assert.doesNotMatch(component, /\.remove\(\)/);
});
