import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import test from "node:test";

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

test("article title uses the unified Yuragi renderer lifecycle", async () => {
	const component = await readFile(
		new URL("../src/components/YuragiTitle.svelte", import.meta.url),
		"utf8",
	);
	const animationUtility = await readFile(
		new URL("../src/utils/yuragi-animation.ts", import.meta.url),
		"utf8",
	);

	assert.match(component, /\brenderYuragiText\b/);
	assert.match(component, /\bYuragiTextHandle\b/);
	assert.match(component, /animation:out:start/);
	assert.match(component, /\bswup\?\.hooks\?\.on/);
	assert.match(
		component,
		/document\.addEventListener\(\s*["']swup:enable["'][\s\S]*?\{\s*once:\s*true\s*\}/,
	);
	assert.match(
		component,
		/document\.removeEventListener\(\s*["']swup:enable["']/,
	);
	assert.match(component, /\.play\(\)/);
	assert.match(component, /\.remove\(\)/);
	assert.doesNotMatch(
		component,
		/\b(?:animateShards|createShardedSvg|layoutShardedText)\b/,
	);
	assert.doesNotMatch(animationUtility, /\bcreateInitialAnimationController\b/);
});
