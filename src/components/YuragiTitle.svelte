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
	animateShards,
	createShardedSvg,
	layoutShardedText,
	type TextOutline,
} from "@yuragi-labs/core";
import "@yuragi-labs/core/style.css";
import { onMount } from "svelte";
import {
	createAnimationBudget,
	runAfterPageTransition,
	runBeforeNextFrame,
	shouldStartTitleEnhancement,
} from "../utils/yuragi-animation";

export let text: string;

type EnhancementState = "fallback" | "pending" | "ready";

const ANIMATION_BUDGET_MS = 300;

let svgHost: HTMLSpanElement;
let enhancementState: EnhancementState = "fallback";
let svgVisible = false;

onMount(() => {
	let disposed = false;
	let outline: TextOutline | undefined;
	let currentSvg: SVGSVGElement | undefined;
	let frame: number | undefined;
	let hasScheduledInitialSettle = false;
	let cancelInitialSettle = () => {};
	let cancelPendingReveal = () => {};
	const media = window.matchMedia("(min-width: 768px)");
	const swupContainer = svgHost.closest("#swup-container");
	const isPageTransitioning = () =>
		swupContainer !== null &&
		Number.parseFloat(getComputedStyle(swupContainer).opacity) < 1;
	const hasFirstContentfulPaint =
		"PerformancePaintTiming" in window
			? performance.getEntriesByName("first-contentful-paint", "paint").length > 0
			: undefined;
	let animationBudget: ReturnType<typeof createAnimationBudget> | undefined;

	function selectFallback() {
		animationBudget?.cancel();
		cancelInitialSettle();
		cancelInitialSettle = () => {};
		cancelPendingReveal();
		cancelPendingReveal = () => {};
		svgVisible = false;
		currentSvg = undefined;
		svgHost.replaceChildren();
		enhancementState = "fallback";
	}

	if (
		shouldStartTitleEnhancement(
			isPageTransitioning(),
			hasFirstContentfulPaint,
		)
	) {
		enhancementState = "pending";
		animationBudget = createAnimationBudget(
			ANIMATION_BUDGET_MS,
			() => {
				if (!disposed) selectFallback();
			},
		);
	}

	function renderSvg() {
		if (!outline || disposed || enhancementState === "fallback") return;

		const maxWidth = svgHost.clientWidth;
		if (maxWidth <= 0) return;

		const layout = layoutShardedText(outline, {
			size: media.matches ? 36 : 30,
			maxWidth,
		});
		const svg = createShardedSvg(layout);
		svg.setAttribute("aria-hidden", "true");
		if (
			enhancementState === "pending" &&
			animationBudget?.claim() !== true
		) {
			return;
		}
		if (enhancementState === "pending") {
			svgVisible = false;
		}
		svgHost.replaceChildren(svg);
		currentSvg = svg;
		enhancementState = "ready";

		if (!hasScheduledInitialSettle) {
			hasScheduledInitialSettle = true;
			cancelInitialSettle = runAfterPageTransition(
				() => {
					if (disposed || !currentSvg) return;
					const svg = currentSvg;
					cancelPendingReveal = runBeforeNextFrame(
						() => {
							void animateShards(svg, {
								type: "settle",
								stagger: "by-x",
							});
						},
						() => {
							if (!disposed) svgVisible = true;
						},
					);
				},
				{
					isTransitioning: isPageTransitioning,
					onTransitionEnd: (run) => {
						if (!swupContainer) {
							run();
							return () => {};
						}

						let completed = false;
						const cleanup = () =>
							swupContainer.removeEventListener(
								"transitionend",
								handleTransitionEnd,
							);
						const finish = () => {
							if (completed) return;
							completed = true;
							cleanup();
							run();
						};
						const handleTransitionEnd = (event: TransitionEvent) => {
							if (
								event.target === swupContainer &&
								event.propertyName === "opacity"
							) {
								finish();
							}
						};

						swupContainer.addEventListener(
							"transitionend",
							handleTransitionEnd,
						);
						if (
							Number.parseFloat(getComputedStyle(swupContainer).opacity) >= 1
						) {
							finish();
						}

						return cleanup;
					},
				},
			);
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

	void getFont()
		.then((font) => font.compile(text))
		.then((compiled) => {
			if (disposed) return;
			outline = compiled;
			render();
		})
		.catch(() => {
			if (disposed) return;
			selectFallback();
		});

	return () => {
		disposed = true;
		if (frame !== undefined) cancelAnimationFrame(frame);
		animationBudget?.cancel();
		cancelInitialSettle();
		cancelPendingReveal();
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
		class="svg-host"
		class:pending-reveal={!svgVisible}
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
