// style.js
// This module exports the style sheet and blur effect functions

import { emitEvent, listenToEvent } from "./helpers.js";

const BLURRY_START_MODE_TIMEOUT = 7000; // TODO: make this a setting maybe?
let hbStyleSheet, blurryStartStyleSheet, _settings;

const initStylesheets = ({ detail }) => {
    _settings = detail;
    // console.log("HB==INIT STYLESHEETS")
    hbStyleSheet = document.createElement("style");
    hbStyleSheet.id = "hb-stylesheet";
    document.head.appendChild(hbStyleSheet);
};

const setStyle = ({ detail: settings }) => {
    _settings = settings;
    // console.log("HB==SET STYLE")
    if (!hbStyleSheet) {
        initStylesheets();
    }
    if (!_settings.shouldDetect()) {
        hbStyleSheet.innerHTML = "";
        return;
    }
    const shouldBlurImages = _settings.shouldBlurImages();
    const shouldBlurVideos = _settings.shouldBlurVideos();
    const shouldUnblurImagesOnHover = _settings.shouldUnblurImages();
    const shouldUnblurVideosOnHover = _settings.shouldUnblurVideos();
    const solidBlur = _settings.isSolidBlur();

    let blurSelectors = [];
    if (shouldBlurImages) blurSelectors.push("img" + ".hb-blur");
    if (shouldBlurVideos) blurSelectors.push("video" + ".hb-blur");
    blurSelectors = blurSelectors.join(", ");

    // solid blur: hide the media element entirely instead of applying a
    // blur filter, which prevents any overlay offset issues (Issue #212)
    const hiddenCss = solidBlur
        ? `${blurSelectors} {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }`
        : `${blurSelectors} {
      filter: blur(${_settings.getBlurAmount()}px) ${
          _settings.isGray() ? "grayscale(100%)" : ""
      } !important;
      transition: filter 0.1s ease !important;
      opacity: unset !important;
    }`;

    let unblurSelectors = [];
    if (shouldUnblurImagesOnHover)
        unblurSelectors.push("img.hb-blur:hover", "img.hb-blur:focus");
    if (shouldUnblurVideosOnHover)
        unblurSelectors.push("video.hb-blur:hover", "video.hb-blur:focus");
    unblurSelectors = unblurSelectors.join(", ");

    hbStyleSheet.innerHTML = hiddenCss;
    if (unblurSelectors) {
        hbStyleSheet.innerHTML += `
		${unblurSelectors} {
			filter: blur(0px) ${_settings.isGray() ? "grayscale(0%)" : ""} !important;
			transition: filter 0.3s ease !important;
			transition-delay: 0.25s !important;
			${
                solidBlur
                    ? "opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;"
                    : ""
            }
		  }
	`;
    }

    const tempBlur = solidBlur
        ? `
    @keyframes hb-blur-temp {
		0% { opacity: 0; visibility: hidden; }
		95% { opacity: 0; visibility: hidden; }
		100% { opacity: 1; visibility: visible; }
	}`
        : `
    @keyframes hb-blur-temp {
		0% { filter: blur(${_settings.getBlurAmount()}px) ${
            _settings.isGray() ? "grayscale(100%)" : ""
        }; }
		95% { filter: blur(${_settings.getBlurAmount()}px) ${
            _settings.isGray() ? "grayscale(100%)" : ""
        }; }
		100% { filter: blur(0px) ${_settings.isGray() ? "grayscale(0%)" : ""}; }
	}`;

    hbStyleSheet.innerHTML += `
	.hb-blur-temp { 
		animation: hb-blur-temp ${BLURRY_START_MODE_TIMEOUT}ms ease-in-out forwards !important;
	}

	#hb-in-canvas {
		display: none !important;
		visibility: hidden !important;
	}

	${tempBlur}
  `;
};
const applyBlurryStart = (node) => {
    if (_settings?.isBlurryStartMode()) {
        node.classList.add("hb-blur-temp");
    }
};

const removeBlurryStart = (node) => {
    node.classList.remove("hb-blur-temp");
};

const attachStyleListener = () => {
    listenToEvent("settingsLoaded", initStylesheets);
    listenToEvent("toggleOnOffStatus", setStyle);
    listenToEvent("changeBlurAmount", setStyle);
    listenToEvent("changeGray", setStyle);
    listenToEvent("changeUnblur", setStyle);
};

export { attachStyleListener, applyBlurryStart, removeBlurryStart };
