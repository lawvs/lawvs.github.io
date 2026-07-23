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

	const assetDirectory = new URL("../dist/_astro/", import.meta.url);
	const assets = await readdir(assetDirectory);
	const wasm = assets.find((asset) => asset.endsWith(".wasm"));

	assert.ok(wasm, "expected a packaged Yuragi WASM asset");
	assert.ok((await stat(new URL(wasm, assetDirectory))).size > 0);
});
