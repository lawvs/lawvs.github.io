<script context="module" lang="ts">
import { createYuragiFont, type YuragiFont } from "@yuragi-labs/core/wasm";

const FONT_URL =
	"https://raw.githubusercontent.com/adobe-fonts/source-han-sans/a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/CN/SourceHanSansCN-Bold.otf";

let fontPromise: Promise<YuragiFont> | undefined;

function getFont() {
	fontPromise ??= createYuragiFont({ font: FONT_URL });
	return fontPromise;
}
</script>

<script lang="ts">
import {
	renderYuragiText,
	type TextOutline,
	type YuragiTextHandle,
} from "@yuragi-labs/core";
import "@yuragi-labs/core/style.css";
import { onMount } from "svelte";
import {
	createAnimationBudget,
	waitForOpaqueTransition,
} from "../utils/yuragi-animation";

export let text: string;

type EnhancementState = "fallback" | "pending" | "ready";

const ANIMATION_BUDGET_MS = 300;
// Hard-stop a stuck gate at five times the current 200 ms Swup fade.
const PAGE_TRANSITION_GATE_TIMEOUT_MS = 1_000;

let svgHost: HTMLSpanElement;
let enhancementState: EnhancementState = "fallback";

onMount(() => {
	const media = window.matchMedia("(min-width: 768px)");
	const swupContainer = svgHost.closest("#swup-container");
	const isPageTransitioning = () =>
		swupContainer !== null &&
		Number.parseFloat(getComputedStyle(swupContainer).opacity) < 1;
	const hasFirstContentfulPaint =
		"PerformancePaintTiming" in window
			? performance.getEntriesByName("first-contentful-paint", "paint").length > 0
			: undefined;
	const shouldEnhance =
		isPageTransitioning() || hasFirstContentfulPaint === false;
	const pendingFont = getFont();

	if (!shouldEnhance) {
		void pendingFont.catch(() => {});
		return;
	}

	type SwupHooks = {
		on(event: "animation:out:start", handler: () => void): () => void;
	};

	let disposed = false;
	let exiting = false;
	let enterRequested = false;
	let enterComplete = false;
	let outline: TextOutline | undefined;
	let titleHandle: YuragiTextHandle | undefined;
	let frame: number | undefined;
	let revealFrame: number | undefined;
	let cancelTransitionWait = () => {};
	let unregisterExit = () => {};

	const setSvgVisible = (visible: boolean) => {
		svgHost.classList.toggle("pending-reveal", !visible);
	};

	function requestEnter() {
		enterRequested = true;
		if (!titleHandle || exiting) return;
		const playingHandle = titleHandle;
		void playingHandle.play().then(() => {
			if (
				titleHandle === playingHandle &&
				!disposed &&
				!exiting
			) {
				enterComplete = true;
			}
		});
		if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
		revealFrame = requestAnimationFrame(() => {
			revealFrame = undefined;
			if (
				titleHandle === playingHandle &&
				!disposed &&
				!exiting
			) {
				setSvgVisible(true);
			}
		});
	}

	function selectFallback() {
		animationBudget.cancel();
		cancelTransitionWait();
		if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
		revealFrame = undefined;
		titleHandle?.dispose();
		titleHandle = undefined;
		setSvgVisible(false);
		svgHost.replaceChildren();
		enhancementState = "fallback";
	}

	enhancementState = "pending";
	const animationBudget = createAnimationBudget(
		ANIMATION_BUDGET_MS,
		selectFallback,
	);
	if (swupContainer) {
		cancelTransitionWait = waitForOpaqueTransition(
			() =>
				Number.parseFloat(getComputedStyle(swupContainer).opacity) >= 1,
			requestEnter,
			selectFallback,
			PAGE_TRANSITION_GATE_TIMEOUT_MS,
		);
	} else {
		requestEnter();
	}

	function renderSvg() {
		if (!outline || disposed || exiting || enhancementState === "fallback") {
			return;
		}

		const maxWidth = svgHost.clientWidth;
		if (maxWidth <= 0) return;

		const initial = enhancementState === "pending";
		if (initial && !animationBudget.claim()) return;

		const shouldAnimate = !enterComplete;
		if (shouldAnimate) setSvgVisible(false);
		titleHandle = renderYuragiText(svgHost, outline, {
			size: media.matches ? 36 : 30,
			maxWidth,
			ariaLabel: false,
			animation: shouldAnimate
				? { autoplay: false, stagger: "by-x" }
				: false,
		});
		enhancementState = "ready";

		if (shouldAnimate && enterRequested) {
			requestEnter();
		} else if (!shouldAnimate) {
			setSvgVisible(true);
		}
	}

	function render() {
		try {
			renderSvg();
		} catch {
			selectFallback();
		}
	}

	function scheduleRender() {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(render);
	}

	const observer = new ResizeObserver(scheduleRender);
	observer.observe(svgHost);
	media.addEventListener("change", scheduleRender);

	function registerExit() {
		const swup = window.swup as unknown as
			| { hooks?: SwupHooks }
			| undefined;
		unregisterExit =
			swup?.hooks?.on("animation:out:start", () => {
				if (disposed || exiting || !titleHandle) return;
				exiting = true;
				cancelTransitionWait();
				if (frame !== undefined) cancelAnimationFrame(frame);
				if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
				const exitingHandle = titleHandle;
				titleHandle = undefined;
				void exitingHandle.remove();
			}) ?? (() => {});
	}

	const swup = window.swup as unknown as
		| { hooks?: SwupHooks }
		| undefined;
	if (swup?.hooks) {
		registerExit();
	} else {
		document.addEventListener("swup:enable", registerExit, { once: true });
	}

	const isPending = () =>
		!disposed && !exiting && enhancementState === "pending";
	void pendingFont
		.then((font) => (isPending() ? font.compile(text) : undefined))
		.then((compiled) => {
			if (compiled === undefined || !isPending()) return;
			outline = compiled;
			render();
		})
		.catch(() => {
			if (isPending()) selectFallback();
		});

	return () => {
		disposed = true;
		document.removeEventListener("swup:enable", registerExit);
		unregisterExit();
		if (frame !== undefined) cancelAnimationFrame(frame);
		if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
		animationBudget.cancel();
		cancelTransitionWait();
		titleHandle?.dispose();
		observer.disconnect();
		media.removeEventListener("change", scheduleRender);
	};
});
</script>

<span
	class="transition w-full block font-bold mb-3 text-3xl md:text-[2.25rem]/[2.75rem]
		text-black/90 dark:text-white/90 md:before:w-1 before:h-5 before:rounded-md
		before:bg-[var(--primary)] before:absolute before:top-[0.75rem] before:left-[-1.125rem]"
	data-pagefind-body
	data-pagefind-weight="10"
	data-pagefind-meta="title"
	data-yuragi-title
>
	<span
		class="fallback-text"
		class:pending={enhancementState === "pending"}
		class:visually-hidden={enhancementState === "ready"}>{text}</span
	>
	<span
		bind:this={svgHost}
		class="svg-host pending-reveal"
		aria-hidden="true"
	></span>
</span>

<style>
.fallback-text {
	transition: none;
}

.pending {
	opacity: 0;
}

.svg-host {
	display: block;
	width: 100%;
}

.pending-reveal {
	visibility: hidden;
}

.svg-host :global(svg) {
	display: block;
	max-width: 100%;
	height: auto;
}

.visually-hidden {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}
</style>
