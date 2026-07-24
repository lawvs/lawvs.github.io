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

	return import(
		`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
	);
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
