import { createYuragiFont, type YuragiFont } from "@yuragi-labs/core/wasm";

const YURAGI_TITLE_FONT_URL =
	"https://cdn.jsdelivr.net/gh/adobe-fonts/source-han-sans@a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2/SubsetOTF/CN/SourceHanSansCN-Bold.otf";

let fontPromise: Promise<YuragiFont> | undefined;
let cachedFont: YuragiFont | undefined;

export function loadYuragiTitleFont() {
	fontPromise ??= createYuragiFont({ font: YURAGI_TITLE_FONT_URL }).then(
		(font) => {
			cachedFont = font;
			return font;
		},
	);
	return fontPromise;
}

export function getCachedYuragiTitleFont() {
	return cachedFont;
}

export function warmYuragiTitleFont() {
	void loadYuragiTitleFont().catch(() => {
		fontPromise = undefined;
	});
}
