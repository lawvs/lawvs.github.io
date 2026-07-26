type TimeoutScheduler = (run: () => void, delayMs: number) => () => void;
type MonotonicClock = () => number;
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

export function waitForOpaqueTransition(
	isOpaque: () => boolean,
	run: () => void,
	onTimeout: () => void,
	timeoutMs: number,
	schedule: FrameScheduler = scheduleFrame,
	now: MonotonicClock = readNow,
) {
	let active = true;
	let cancelFrame = noop;
	const deadline = now() + timeoutMs;

	const cancel = () => {
		if (!active) return;
		active = false;
		cancelFrame();
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
		if (now() >= deadline) {
			finish(onTimeout);
			return;
		}
		cancelFrame = schedule(check);
	};

	check();

	return cancel;
}
