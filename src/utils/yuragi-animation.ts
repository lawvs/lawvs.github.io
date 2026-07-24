export interface PageTransitionGate {
	isTransitioning: () => boolean;
	onTransitionEnd: (run: () => void) => () => void;
}

const noop = () => {};

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
