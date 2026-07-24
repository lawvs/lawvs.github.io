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

test("claims a Yuragi animation budget before its deadline", async () => {
	const { createAnimationBudget } = await loadTransitionGate();
	let expire;
	let cancellations = 0;
	let expirations = 0;
	const budget = createAnimationBudget(
		300,
		() => {
			expirations += 1;
		},
		(run, delayMs) => {
			assert.equal(delayMs, 300);
			expire = run;
			return () => {
				cancellations += 1;
			};
		},
	);

	assert.equal(budget.claim(), true);
	assert.equal(budget.claim(), false);
	assert.equal(cancellations, 1);
	expire();
	assert.equal(expirations, 0);
});

test("expires a Yuragi animation budget and rejects a late claim", async () => {
	const { createAnimationBudget } = await loadTransitionGate();
	let expire;
	let expirations = 0;
	const budget = createAnimationBudget(
		300,
		() => {
			expirations += 1;
		},
		(run) => {
			expire = run;
			return () => {};
		},
	);

	expire();
	assert.equal(expirations, 1);
	assert.equal(budget.claim(), false);
});

test("rejects a claim after the deadline even when the timer is delayed", async () => {
	const { createAnimationBudget } = await loadTransitionGate();
	let expire;
	let cancellations = 0;
	let expirations = 0;
	let now = 1_000;
	const budget = createAnimationBudget(
		300,
		() => {
			expirations += 1;
		},
		(run) => {
			expire = run;
			return () => {
				cancellations += 1;
			};
		},
		() => now,
	);

	now = 1_301;
	assert.equal(budget.claim(), false);
	assert.equal(expirations, 1);
	assert.equal(cancellations, 1);
	expire();
	assert.equal(expirations, 1);
});

test("only starts title enhancement before paint or during a page transition", async () => {
	const { shouldStartTitleEnhancement } = await loadTransitionGate();

	assert.equal(shouldStartTitleEnhancement(true, true), true);
	assert.equal(shouldStartTitleEnhancement(false, false), true);
	assert.equal(shouldStartTitleEnhancement(false, true), false);
	assert.equal(shouldStartTitleEnhancement(false, undefined), false);
});
