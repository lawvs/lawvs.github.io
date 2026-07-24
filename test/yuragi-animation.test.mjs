import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadYuragiAnimationModule() {
	const source = await readFile(
		new URL("../src/utils/yuragi-animation.ts", import.meta.url),
		"utf8",
	).catch(() => "");
	assert.notEqual(source, "", "expected the Yuragi animation module");

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
	const { runAfterPageTransition } = await loadYuragiAnimationModule();
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
	const { runAfterPageTransition } = await loadYuragiAnimationModule();
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
	const { createAnimationBudget } = await loadYuragiAnimationModule();
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
	const { createAnimationBudget } = await loadYuragiAnimationModule();
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
	const { createAnimationBudget } = await loadYuragiAnimationModule();
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
	const { shouldStartTitleEnhancement } = await loadYuragiAnimationModule();

	assert.equal(shouldStartTitleEnhancement(true, true), true);
	assert.equal(shouldStartTitleEnhancement(false, false), true);
	assert.equal(shouldStartTitleEnhancement(false, true), false);
	assert.equal(shouldStartTitleEnhancement(false, undefined), false);
});

test("warms the Yuragi font without compiling fallback titles", async () => {
	const { loadTitleOutlineIfEnhancing } = await loadYuragiAnimationModule();
	let compiles = 0;
	let loads = 0;

	const outline = await loadTitleOutlineIfEnhancing(
		() => {
			loads += 1;
			return Promise.resolve({
				compile: () => {
					compiles += 1;
					return Promise.resolve("outline");
				},
			});
		},
		"title",
		false,
	);

	assert.equal(outline, undefined);
	assert.equal(loads, 1);
	assert.equal(compiles, 0);
});

test("handles rejected fallback font warmups without compiling", async () => {
	const { loadTitleOutlineIfEnhancing } = await loadYuragiAnimationModule();

	const outline = await loadTitleOutlineIfEnhancing(
		() => Promise.reject(new Error("font unavailable")),
		"title",
		false,
	);

	await Promise.resolve();
	assert.equal(outline, undefined);
});

test("compiles Yuragi titles selected for enhancement", async () => {
	const { loadTitleOutlineIfEnhancing } = await loadYuragiAnimationModule();
	let compiles = 0;

	const outline = await loadTitleOutlineIfEnhancing(
		() =>
			Promise.resolve({
				compile: (text) => {
					compiles += 1;
					return Promise.resolve(`outline:${text}`);
				},
			}),
		"title",
		true,
	);

	assert.equal(outline, "outline:title");
	assert.equal(compiles, 1);
});

test("hides and re-arms a same-frame replacement after reveal", async () => {
	const { createInitialAnimationController } =
		await loadYuragiAnimationModule();
	const completions = new Map();
	const events = [];
	const frames = [];
	const controller = createInitialAnimationController(
		(value) => {
			events.push(`animate:${value}`);
			return new Promise((resolve) => {
				completions.set(value, resolve);
			});
		},
		() => events.push("hide"),
		() => events.push("reveal"),
		(run) => {
			let active = true;
			frames.push(() => {
				if (active) run();
			});
			return () => {
				active = false;
			};
		},
	);

	controller.replace("first", () => events.push("install:first"));
	controller.start();
	frames.shift()();
	assert.deepEqual(events, [
		"hide",
		"install:first",
		"animate:first",
		"reveal",
	]);

	controller.replace("replacement", () => events.push("install:replacement"));
	assert.deepEqual(events.slice(-3), [
		"hide",
		"install:replacement",
		"animate:replacement",
	]);

	completions.get("first")();
	await Promise.resolve();
	controller.replace("latest", () => events.push("install:latest"));
	assert.deepEqual(events.slice(-3), [
		"hide",
		"install:latest",
		"animate:latest",
	]);

	frames.shift()();
	frames.shift()();
	assert.equal(events.at(-1), "reveal");

	completions.get("latest")();
	await Promise.resolve();
	controller.replace("complete", () => events.push("install:complete"));
	assert.deepEqual(events.slice(-2), ["reveal", "install:complete"]);
});

test("makes late initial-animation completion harmless after cancellation", async () => {
	const { createInitialAnimationController } =
		await loadYuragiAnimationModule();
	const events = [];
	const frames = [];
	let complete;
	const controller = createInitialAnimationController(
		(value) => {
			events.push(`animate:${value}`);
			return new Promise((resolve) => {
				complete = resolve;
			});
		},
		() => events.push("hide"),
		() => events.push("reveal"),
		(run) => {
			let active = true;
			frames.push(() => {
				if (active) run();
			});
			return () => {
				active = false;
			};
		},
	);

	controller.replace("first", () => events.push("install:first"));
	controller.start();
	controller.cancel();
	complete();
	await Promise.resolve();
	frames.shift()();
	assert.deepEqual(events, ["hide", "install:first", "animate:first"]);
});
