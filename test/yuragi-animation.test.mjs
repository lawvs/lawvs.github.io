import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadYuragiAnimationModule() {
	const source = await readFile(
		new URL("../src/utils/yuragi-animation.ts", import.meta.url),
		"utf8",
	);
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

const animationModule = loadYuragiAnimationModule();

function createFrameScheduler() {
	const frames = [];

	return {
		schedule(run) {
			let active = true;
			frames.push(() => {
				if (!active) return;
				active = false;
				run();
			});
			return () => {
				active = false;
			};
		},
		runNext() {
			assert.notEqual(frames.length, 0, "expected a scheduled frame");
			frames.shift()();
		},
		get pending() {
			return frames.length;
		},
	};
}

test("runs immediately when the page transition is already opaque", async () => {
	const { waitForOpaqueTransition } = await animationModule;
	const frames = createFrameScheduler();
	let runs = 0;

	waitForOpaqueTransition(
		() => true,
		() => {
			runs += 1;
		},
		() => assert.fail("an opaque transition must not time out"),
		1_000,
		frames.schedule,
		() => 0,
	);

	assert.equal(runs, 1);
	assert.equal(frames.pending, 0);
});

test("waits until a defensive frame observes an opaque transition", async () => {
	const { waitForOpaqueTransition } = await animationModule;
	const frames = createFrameScheduler();
	let opaque = false;
	let runs = 0;

	waitForOpaqueTransition(
		() => opaque,
		() => {
			runs += 1;
		},
		() => assert.fail("the transition must not time out"),
		1_000,
		frames.schedule,
		() => 0,
	);

	assert.equal(runs, 0);
	opaque = true;
	frames.runNext();
	assert.equal(runs, 1);
});

test("prefers an opaque transition over fallback after a delayed frame", async () => {
	const { waitForOpaqueTransition } = await animationModule;
	const frames = createFrameScheduler();
	let now = 0;
	let opaque = false;
	let runs = 0;
	let fallbacks = 0;

	waitForOpaqueTransition(
		() => opaque,
		() => {
			runs += 1;
		},
		() => {
			fallbacks += 1;
		},
		1_000,
		frames.schedule,
		() => now,
	);

	now = 1_001;
	opaque = true;
	frames.runNext();
	assert.equal(runs, 1);
	assert.equal(fallbacks, 0);
});

test("selects fallback when the page transition misses its deadline", async () => {
	const { waitForOpaqueTransition } = await animationModule;
	const frames = createFrameScheduler();
	let now = 0;
	let fallbacks = 0;

	waitForOpaqueTransition(
		() => false,
		() => assert.fail("a hidden transition must not run"),
		() => {
			fallbacks += 1;
		},
		1_000,
		frames.schedule,
		() => now,
	);

	now = 1_001;
	frames.runNext();
	assert.equal(fallbacks, 1);
});

test("cancels a pending transition frame without a late callback", async () => {
	const { waitForOpaqueTransition } = await animationModule;
	const frames = createFrameScheduler();
	let opaque = false;
	let runs = 0;
	let fallbacks = 0;

	const cancel = waitForOpaqueTransition(
		() => opaque,
		() => {
			runs += 1;
		},
		() => {
			fallbacks += 1;
		},
		1_000,
		frames.schedule,
		() => 0,
	);

	cancel();
	opaque = true;
	frames.runNext();
	assert.equal(runs, 0);
	assert.equal(fallbacks, 0);
});

test("claims a Yuragi animation budget before its deadline", async () => {
	const { createAnimationBudget } = await animationModule;
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
	const { createAnimationBudget } = await animationModule;
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

test("rejects a budget claim after a delayed timer deadline", async () => {
	const { createAnimationBudget } = await animationModule;
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

test("hides and re-arms a same-frame replacement before revealing it", async () => {
	const { createInitialAnimationController } = await animationModule;
	const completions = new Map();
	const events = [];
	const frames = createFrameScheduler();
	const controller = createInitialAnimationController(
		(value) => {
			events.push(`animate:${value}`);
			return new Promise((resolve) => {
				completions.set(value, resolve);
			});
		},
		() => events.push("hide"),
		() => events.push("reveal"),
		frames.schedule,
	);

	controller.replace("first", () => events.push("install:first"));
	controller.start();
	frames.runNext();
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

	frames.runNext();
	frames.runNext();
	assert.equal(events.at(-1), "reveal");

	completions.get("latest")();
	await Promise.resolve();
	controller.replace("complete", () => events.push("install:complete"));
	assert.deepEqual(events.slice(-2), ["reveal", "install:complete"]);
});

test("ignores late animation completion after cancellation", async () => {
	const { createInitialAnimationController } = await animationModule;
	const events = [];
	const frames = createFrameScheduler();
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
		frames.schedule,
	);

	controller.replace("first", () => events.push("install:first"));
	controller.start();
	controller.cancel();
	complete();
	await Promise.resolve();
	frames.runNext();
	assert.deepEqual(events, ["hide", "install:first", "animate:first"]);
});
