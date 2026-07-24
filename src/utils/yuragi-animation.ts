export interface PageTransitionGate {
	isTransitioning: () => boolean;
	onTransitionEnd: (run: () => void) => () => void;
}

export type TimeoutScheduler = (run: () => void, delayMs: number) => () => void;
export type MonotonicClock = () => number;
export type FrameScheduler = (run: () => void) => () => void;

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

export function runBeforeNextFrame(
	run: () => void,
	afterFrame: () => void,
	schedule: FrameScheduler = scheduleFrame,
) {
	run();
	return schedule(afterFrame);
}

export function runBeforeStableFrame<T>(
	readCurrent: () => T,
	run: (current: T) => void,
	afterFrame: (current: T) => void,
	schedule: FrameScheduler = scheduleFrame,
) {
	let active = true;
	let cancelFrame = noop;

	const arm = () => {
		const current = readCurrent();
		run(current);
		cancelFrame = schedule(() => {
			if (!active) return;
			if (readCurrent() !== current) {
				arm();
				return;
			}
			active = false;
			afterFrame(current);
		});
	};

	arm();
	return () => {
		if (!active) return;
		active = false;
		cancelFrame();
	};
}
