// style.js
// This module exports the style sheet and blur effect functions

import { emitEvent, listenToEvent } from "./helpers.js";

const BLURRY_START_MODE_TIMEOUT = 7000; // TODO: make this a setting maybe?
let hbStyleSheet,
	blurryStartStyleSheet,
	_settings;

const initStylesheets = ({detail}) => {
	_settings = detail;
	// console.log("HB==INIT STYLESHEETS")
	hbStyleSheet = document.createElement("style");
	hbStyleSheet.id = "hb-stylesheet";
	document.head.appendChild(hbStyleSheet);
	initBlurryMode();
};

const initBlurryMode = () => {
	if (!_settings.shouldDetect() || !_settings.isBlurryStartMode()) return;
	blurryStartStyleSheet = document.createElement("style");
	blurryStartStyleSheet.id = "hb-blurry-start-stylesheet";
	blurryStartStyleSheet.innerHTML = `
	  img:not(#hb-logo), video{
		filter: blur(${_settings.getBlurAmount()}px) ${
		_settings.isGray() ? "grayscale(100%)" : ""
	} !important;
		transition: filter 0.1s ease !important;
		opacity: unset !important;
	  }

	  img:not(#hb-logo):hover, video:hover{
		filter: blur(0px) ${_settings.isGray() ? "grayscale(0%)" : ""} !important;
		transition: filter 0.5s ease !important;
		transition-delay: 0.5s !important;
	  }
	`;

	document.head.appendChild(blurryStartStyleSheet);

	// issue event turn off blurry start mode after 1 second
	setTimeout(() => {
		if (!blurryStartStyleSheet?.innerHTML) return; // if blurryStartStyleSheet wasn't instantiated/was removed, return
		emitEvent("blurryStartModeTimeout", "timeout");
	}, BLURRY_START_MODE_TIMEOUT);
};

const setStyle = ({detail:settings}) => {
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
      filter: blur(${_settings.getBlurAmount()}px) ${
		_settings.isGray() ? "grayscale(100%)" : ""
	} !important;
      transition: filter 0.1s ease !important;
      opacity: unset !important;
    }
	
  `;
	if (unblurSelectors) {
		hbStyleSheet.innerHTML += `
		${unblurSelectors} {
			filter: blur(0px) ${_settings.isGray() ? "grayscale(0%)" : ""} !important;
			transition: filter 0.5s ease !important;
			transition-delay: 1s !important;
		  }
	`;
	}

	hbStyleSheet.innerHTML += `
	.hb-blur-temp { 
		animation: hb-blur-temp ${BLURRY_START_MODE_TIMEOUT}ms ease-in-out forwards !important;
	}

	@keyframes hb-blur-temp {
		0% { filter: blur(${_settings.getBlurAmount()}px) ${
		_settings.isGray() ? "grayscale(100%)" : ""
	}; }
		95% { filter: blur(${_settings.getBlurAmount()}px) ${
		_settings.isGray() ? "grayscale(100%)" : ""
	}; }
		100% { filter: blur(0px) ${_settings.isGray() ? "grayscale(0%)" : ""}; }
	}
  `;
};

const turnOffBlurryStart = (e) => {
	if (!blurryStartStyleSheet?.innerHTML) return; // if blurryStartStyleSheet wasn't instantiated/was removed, return
	blurryStartStyleSheet.innerHTML = "";
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
	listenToEvent("detectionStarted", turnOffBlurryStart);
	// listenToEvent("queuingStarted", turnOffBlurryStart);
	listenToEvent("blurryStartModeTimeout", turnOffBlurryStart);
};

export { attachStyleListener, applyBlurryStart, removeBlurryStart };
