// style.js
// This module exports the style sheet and blur effect functions

import { listenToEvent } from "./helpers.js";
import { settings, shouldDetect } from "./settings.js";

let hbStyleSheet;

const initStylesheet = () => {
	hbStyleSheet = document.createElement("style");
	hbStyleSheet.id = "hb-stylesheet";
	document.head.appendChild(hbStyleSheet);
};

const setStyle = () => {
	console.log("HB==SET STYLE")
	if (!hbStyleSheet) {
		initStylesheet();
	}
	if (!shouldDetect()) {
		hbStyleSheet.innerHTML = "";
		return;
	}
	const shouldBlurImages = settings.blurImages;
	const shouldBlurVideos = settings.blurVideos;
	const shouldUnblurImagesOnHover = settings.unblurImages;
	const shouldUnblurVideosOnHover = settings.unblurVideos;

	let blurSelectors = [];
	if (shouldBlurImages) blurSelectors.push("img" + ".hb-blur");
	if (shouldBlurVideos) blurSelectors.push("video" + ".hb-blur");
	blurSelectors = blurSelectors.join(", ");

	let unblurSelectors = [];
	if (shouldUnblurImagesOnHover)
		unblurSelectors.push("img" + ".hb-blur:hover");
	if (shouldUnblurVideosOnHover)
		unblurSelectors.push("video" + ".hb-blur:hover");
	unblurSelectors = unblurSelectors.join(", ");
	hbStyleSheet.innerHTML = `
    ${blurSelectors} {
      filter: blur(${settings.blurAmount}px) grayscale(100%);
      transition: filter 0.1s ease;
      opacity: unset;
    }

    // when hovering, gradually remove grayscale for 1 second, then gradually remove blur
    ${unblurSelectors} {
      filter: grayscale(0%);
      transition: filter 0.5s ease;
    }
    ${unblurSelectors} {
      filter: blur(0px);
      transition: filter 0.5s ease;
      transition-delay: 1s;
    }
  `;
};

const attachStyleListener = () => {
	listenToEvent("toggleOnOffStatus", setStyle);
	listenToEvent("changeBlurAmount", setStyle);
};

export { attachStyleListener };
