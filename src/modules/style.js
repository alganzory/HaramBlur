// style.js
// This module exports the style sheet and blur effect functions

import { emitEvent, listenToEvent } from "./helpers.js";
import { STATUSES, getDetectionQueue } from "./observers.js";
import { settings, shouldDetect, isBlurryStartMode } from "./settings.js";

const BLURRY_START_MODE_TIMEOUT = 7000; // TODO: make this a setting maybe?
let hbStyleSheet, blurryStartStyleSheet, queuingStarted = false;
const initStylesheets = () => {
	// console.log("HB==INIT STYLESHEETS")
	hbStyleSheet = document.createElement("style");
	hbStyleSheet.id = "hb-stylesheet";
	document.head.appendChild(hbStyleSheet);
	initBlurryMode();
};

const initBlurryMode = () => {
	if (!shouldDetect() || !isBlurryStartMode()) return;
	blurryStartStyleSheet = document.createElement("style");
	blurryStartStyleSheet.id = "hb-blurry-start-stylesheet";
	blurryStartStyleSheet.innerHTML = `
	  img:not(#hb-logo), video{
		filter: blur(${settings.blurAmount}px) grayscale(100%) !important;
		transition: filter 0.1s ease !important;
		opacity: unset !important;
	  }

	  img:not(#hb-logo):hover, video:hover{
		filter: blur(0px) grayscale(0%) !important;
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

const setStyle = () => {
	// console.log("HB==SET STYLE")
	if (!hbStyleSheet) {
		initStylesheets();
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
      filter: blur(${settings.blurAmount}px) grayscale(100%) !important;
      transition: filter 0.1s ease !important;
      opacity: unset !important;
    }
	
  `;
	if (unblurSelectors) {
		hbStyleSheet.innerHTML += `
		${unblurSelectors} {
			filter: blur(0px) grayscale(0%) !important;
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
		0% { filter: blur(${settings.blurAmount}px) grayscale(100%); }
		95% { filter: blur(${settings.blurAmount}px) grayscale(100%); }
		100% { filter: blur(0px) grayscale(0%); }
	}
  `;
};

const turnOffBlurryStart = (e) => {
	if (!blurryStartStyleSheet?.innerHTML) return; // if blurryStartStyleSheet wasn't instantiated/was removed, return
	blurryStartStyleSheet.innerHTML = "";
};

const applyBlurryStart = (node) => {
	if (!isBlurryStartMode()) return;
	node.classList.add("hb-blur-temp");
};

var splashScreen;
var splashScreenShown = false;
const turnOffSplashScreen = (e) => {
	if (splashScreen) splashScreen.remove();
};

const _showSplashScreen = () => {
	const iconURL = chrome.runtime.getURL("src/assets/hb-icon-128.png");
	// the splash screen overlays the entire page, it's a slightly transparent white background with a logo in the middle
	// Create overlay
	splashScreen = document.createElement("div");
	splashScreen.id = "splashScreen";
	splashScreen.innerHTML = `
	  <style>

		@keyframes spin {
		  0% { transform: rotate(0deg); }
		  100% { transform: rotate(360deg); }
		}

		#splashScreenElement {
		  position: fixed;
		  top: 0;
		  left: 0;
		  width: 100%;
		  height: 100%;
		  background-color: rgba(0, 0, 0, 0.8);
		  display: flex;
		  justify-content: center;
		  align-items: center;
		  flex-direction: column;
		  backdrop-filter: blur(10px);
		  z-index: 9999;
		  padding: 20px;
		  box-sizing: border-box;
		}

		
@keyframes rotate {
	100% {
		transform: rotate(1turn);
	}
}

.hb-spinner {
	position: relative;
	z-index: 0;
	border-radius: 50%;
	overflow: hidden;
	padding: 2rem;
	display: flex;
	justify-content: center;
	align-items: center;
	font-family: sans-serif;
	font-weight: bold;
	margin-bottom: 1rem;
	
	&::before {
		content: '';
		position: absolute;
		z-index: -2;
		left: -50%;
		top: -50%;
		width: 200%;
		height: 200%;
		background-repeat: no-repeat;
		background-size: 50% 50%, 50% 50%;
		background-position: 0 0, 100% 0, 100% 100%, 0 100%;
		background: #40E0D0;  /* fallback for old browsers */
		background: -webkit-linear-gradient(to right, #FF0080, #FF8C00, #40E0D0);  /* Chrome 10-25, Safari 5.1-6 */
		background: linear-gradient(to right, #FF0080, #FF8C00, #40E0D0); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */		
		animation: rotate 0.5s linear infinite;
	}
	
	&::after {
		content: '';
		position: absolute;
		z-index: -1;
		left: 6px;
		top: 6px;
		width: calc(100% - 12px);
		height: calc(100% - 12px);
		background: black;
		border-radius: 50%;
	}
}							

		#hb-buttons {
		  display: flex;
		  gap: 10px;
		  margin-top: 20px;
		}
		.hb-button {
		  background-color: #8D41D8;
		  border: none;
		  color: white !important;
		  padding: 10px 20px;
		  text-align: center;
		  text-decoration: none;
		  display: inline-block;
		  font-size: 14px;
		  cursor: pointer;
		}

		#hb-disableButton {
		  background-color: #C0C0C0;
		  color: #333333 !important;
		}
		

		.hb-button:hover {
			opacity: 0.8;
		}

		#splashScreenElement h3 {
			color: white;		
			font-size: 20px;
			font-family: sans-serif;
		}

	  </style>
	  <div id="splashScreenElement">
		<div class="hb-spinner">
			<img id="hb-logo" src="${iconURL}" />
		</div>
		<h3> Detecting Haram content... </h3>
		<div id="hb-buttons">
		<button class="hb-button" id="hb-hideButton" > Hide Overlay</button>
		  <button class="hb-button" id="hb-disableButton" >Disable this time</button>
		</div>
	  </div>
	`;

	splashScreen
		.querySelector("#hb-disableButton")?.addEventListener("click", () => {
			emitEvent("disableOnce");
		});

	splashScreen
		.querySelector("#hb-hideButton")?.addEventListener("click", () => {
			splashScreen.remove();
		});

	splashScreen.querySelector("#hb-logo").dataset.HBstatus =
		STATUSES.PROCESSED;

	document.onreadystatechange = () => {
		if (document.readyState === "complete") {
			if (!queuingStarted) {
				// if observation has not started and it's been 1 second, means we have no images to process
				splashScreen.remove();
			}
		}
	};

	document.body.prepend(splashScreen);
};

const showSplashScreen = () => {
	// console.log ("HB==SHOW SPLASH SCREEN", document.body, splashScreenShown)
	if (document.body && !splashScreenShown) {
		_showSplashScreen();
		splashScreenShown = true;
	}
};

const setQueuingStarted = () => {
	queuingStarted = true;
};

const attachStyleListener = () => {
	listenToEvent("settingsLoaded", initStylesheets);
	listenToEvent("toggleOnOffStatus", setStyle);
	listenToEvent("changeBlurAmount", setStyle);
	listenToEvent("queuingStarted", setQueuingStarted);
	listenToEvent("detectionStarted", turnOffSplashScreen);
	listenToEvent("detectionStarted", turnOffBlurryStart);
	listenToEvent("disableOnce", turnOffSplashScreen);
	// listenToEvent("queuingStarted", turnOffBlurryStart);
	listenToEvent("blurryStartModeTimeout", turnOffBlurryStart);
};

export { attachStyleListener, showSplashScreen , applyBlurryStart};
