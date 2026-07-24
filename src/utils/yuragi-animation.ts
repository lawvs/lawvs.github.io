export interface PageTransitionGate {
	isTransitioning: () => boolean;
	onTransitionEnd: (run: () => void) => () => void;
}

export type TimeoutScheduler = (run: () => void, delayMs: number) => () => void;
export type MonotonicClock = () => number;
type FrameScheduler = (run: () => void) => () => void;

const noop = () => {};

const scheduleTimeout: TimeoutScheduler = (run, delayMs) => {
	const timeout = setTimeout(run, delayMs);
	return () => clearTimeout(timeout);
};

const scheduleFrame: FrameScheduler = (run) => {
	const frame = requestAnimationFrame(run);
	return () => cancelAnimationFrame(frame);
};

const readNow: MonotonicClock = () => performance.now();

export function createAnimationBudget(
	durationMs: number,
	onExpire: () => void,
	schedule: TimeoutScheduler = scheduleTimeout,
	now: MonotonicClock = readNow,
) {
	let active = true;
	const deadline = now() + durationMs;
	const expire = () => {
		if (!active) return;
		active = false;
		onExpire();
	};
	const cancelTimeout = schedule(expire, durationMs);

	return {
		claim() {
			if (!active) return false;
			if (now() >= deadline) {
				cancelTimeout();
				expire();
				return false;
			}
			active = false;
			cancelTimeout();
			return true;
		},
		cancel() {
			if (!active) return;
			active = false;
			cancelTimeout();
		},
	};
}

export function shouldStartTitleEnhancement(
	isPageTransitioning: boolean,
	hasFirstContentfulPaint: boolean | undefined,
) {
	return isPageTransitioning || hasFirstContentfulPaint === false;
}

export function loadTitleOutlineIfEnhancing<T>(
	loadFont: () => Promise<{ compile: (text: string) => Promise<T> }>,
	text: string,
	shouldCompile: () => boolean,
) {
	return loadFont().then(
		(loaded) => (shouldCompile() ? loaded.compile(text) : undefined),
		(error: unknown) => {
			if (shouldCompile()) throw error;
			return undefined;
		},
	);
}

export function runAfterPageTransition(
	run: () => void,
	gate: PageTransitionGate,
) {
	if (!gate.isTransitioning()) {
		run();
		return noop;
	}

	return gate.onTransitionEnd(run);
}

export function waitForOpaqueTransition(
	target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
	isOpaque: () => boolean,
	run: () => void,
	onTimeout: () => void,
	timeoutMs: number,
	schedule: FrameScheduler = scheduleFrame,
	scheduleExpiry: TimeoutScheduler = scheduleTimeout,
) {
	let active = true;
	let cancelFrame = noop;
	let cancelExpiry = noop;

	const cancel = () => {
		if (!active) return;
		active = false;
		target.removeEventListener("transitionend", handleTransition);
		target.removeEventListener("transitioncancel", handleTransition);
		cancelFrame();
		cancelExpiry();
	};
	const finish = (callback: () => void) => {
		if (!active) return;
		cancel();
		callback();
	};
	const check = () => {
		if (!active) return;
		if (isOpaque()) {
			finish(run);
			return;
		}
		cancelFrame = schedule(check);
	};
	const expire = () => {
		if (!active) return;
		finish(isOpaque() ? run : onTimeout);
	};
	const handleTransition: EventListener = (event) => {
		if (
			event.target === target &&
			(event as TransitionEvent).propertyName === "opacity" &&
			isOpaque()
		) {
			finish(run);
		}
	};

	target.addEventListener("transitionend", handleTransition);
	target.addEventListener("transitioncancel", handleTransition);
	cancelExpiry = scheduleExpiry(expire, timeoutMs);
	check();

	return cancel;
}

export function createInitialAnimationController<T>(
	animate: (current: T) => PromiseLike<unknown> | undefined,
	hide: () => void,
	reveal: () => void,
	schedule: FrameScheduler = scheduleFrame,
) {
	type Current = { value: T };
	type Phase = "waiting" | "active" | "complete" | "cancelled";

	let phase: Phase = "waiting";
	let current: Current | undefined;
	let generation = 0;
	let cancelReveal = noop;

	const arm = (armed: Current) => {
		const armedGeneration = ++generation;
		cancelReveal();
		const completion = animate(armed.value);
		cancelReveal = schedule(() => {
			if (
				phase === "active" &&
				current === armed &&
				generation === armedGeneration
			) {
				reveal();
			}
		});

		void Promise.resolve(completion).then(() => {
			if (
				phase !== "active" ||
				current !== armed ||
				generation !== armedGeneration
			) {
				return;
			}
			phase = "complete";
			cancelReveal();
			cancelReveal = noop;
			reveal();
		}, noop);
	};

	return {
		replace(value: T, install: () => void) {
			if (phase === "waiting" || phase === "active") {
				hide();
			}
			install();
			current = { value };
			if (phase === "active") {
				arm(current);
			}
		},
		start() {
			if (phase !== "waiting") return;
			phase = "active";
			if (current) arm(current);
		},
		cancel() {
			if (phase === "cancelled") return;
			phase = "cancelled";
			current = undefined;
			generation += 1;
			cancelReveal();
			cancelReveal = noop;
		},
	};
}
