// observers.js
// This module exports mutation observer and image processing logic.

import { runDetection } from "./processing.js"; // import the runDetection function from processing.js
import {
	emitEvent,
	listenToEvent,
	loadImage,
	loadVideo,
	processNode,
} from "./helpers.js";
import { shouldDetect } from "./settings.js";
import {  applyBlurryStart, showSplashScreen } from "./style.js";

const BATCH_SIZE = 20; //TODO: make this a setting/calculated based on the device's performance

let mutationObserver;
let loadingQueue = [];
let detectionQueue = [];
let queuingStarted = false;
let activeProcessing = 0;
let activeLoading = 0;
let isDetectionReady = false;

const STATUSES = {
	// the numbers are there to make it easier to sort
	ERROR: "-1ERROR",
	OBSERVED: "0OBSERVED",
	QUEUED: "1QUEUED",
	LOADING: "2LOADING",
	LOADED: "3LOADED",
	PROCESSING: "4PROCESSING",
	PROCESSED: "5PROCESSED",
	INVALID: "9INVALID",
};

const handleElementLoading = async (node) => {
	try {
		let validNode = false;
		node.dataset.HBstatus = STATUSES.LOADING;
		if (node.tagName === "IMG") {
			validNode = await loadImage(node);
		} else if (node.tagName === "VIDEO") {
			validNode = await loadVideo(node);
		}
		if (!validNode) {
			node.dataset.HBstatus = STATUSES.INVALID;
			return;
		}

		flagStartQueuing(node);

		node.dataset.HBstatus = STATUSES.LOADED;
		detectionQueue.push(node);
	} catch (error) {
		node.dataset.HBstatus = STATUSES.ERROR;
		// throw error;
	} finally {
		activeLoading--;
		loadNextImage(); // Start loading the next image
	}
};

const handleElementProcessing = async (img) => {
	try {
		await runDetection(img);
	} catch (err) {
		// console.error(err, img); //TODO: enable logging in debug mode
	} finally {
		activeProcessing--;
		processNextImage(); // Start processing the next image
	}
};

const loadNextImage = async () => {
	while (activeLoading < BATCH_SIZE * 10) {
		let nextImage = loadingQueue.shift();
		if (nextImage) {
			activeLoading++;
			 handleElementLoading(nextImage);
		} else {
			break;
		}
	}
};

const processNextImage = async () => {
	while (activeProcessing < BATCH_SIZE) {
		let nextImage = detectionQueue.shift();
		if (nextImage) {
			activeProcessing++;
			handleElementProcessing(nextImage);
		} else {
			break;
		}
	}
};

const addToLoadingQueue = async (node) => {
	try {
		if (
			node.dataset.HBstatus &&
			node.dataset.HBstatus >= STATUSES.PROCESSING
		)
			return; // if the element is already being processed, return

		loadingQueue.push(node);
		node.dataset.HBstatus = STATUSES.QUEUED;
	} catch (error) {
		console.error("HB== addToQueue error", error);
	}
};

const flagStartQueuing = (node) => {
	if (queuingStarted) return;
	queuingStarted = true;
	// console.log("HB== queuing started", node);
	emitEvent("queuingStarted");
};

const initMutationObserver = () => {
	if (mutationObserver) mutationObserver.disconnect();
	mutationObserver = new MutationObserver((mutations) => {
		showSplashScreen();
		mutations.forEach((mutation) => {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					processNode(node, observeNode);
				});
			} else if (mutation.type === "attributes") {
				// if the src attribute of an image or video changes, process it
				const node = mutation.target;
				if (node.tagName === "IMG" || node.tagName === "VIDEO")
					observeNode(node);
			}
		});

		shouldDetect && loadNextImage();

		if (isDetectionReady) {
			shouldDetect() && processNextImage();
		}
	});

	mutationObserver.observe(document, {
		childList: true,
		characterData: false,
		subtree: true,
		attributes: true,
		attributeFilter: ["src"],
	});

	// process all images and videos that are already in the DOM
	processNode(document, observeNode);
};

const attachObserversListener = () => {
	listenToEvent("disableOnce", () => {
		mutationObserver?.disconnect();
		// console.log("HB== Observers Listener", "disconnecting");
	});
	listenToEvent("settingsLoaded", () => {
		if (shouldDetect()) {
			initMutationObserver();
			loadNextImage();
		} else {
			mutationObserver?.disconnect();
		}
	});
	listenToEvent("toggleOnOffStatus", async () => {
		isDetectionReady = true;
		// console.log("HB== Observers Listener", shouldDetect());
		if (shouldDetect()) {
			// process all images and videos that are already in the DOM
			processNextImage();
		} else {
			// console.log("HB== Observers Listener", "disconnecting");
			mutationObserver?.disconnect();
		}
	});
};

function observeNode(node) {
	// if the node is already being processed, return
	if (
		node.dataset.HBstatus &&
		node.dataset.HBstatus >= STATUSES.QUEUED &&
		node.dataset.HBstatus < STATUSES.PROCESSED
	)
		return;


	applyBlurryStart(node);

	node.dataset.HBstatus = STATUSES.OBSERVED;
	if (node.src) {
		// if there's no src attribute yet, wait for the mutation observer to catch it
		addToLoadingQueue(node);
	} else {
		// remove the HBstatus if the node has no src attribute
		delete node.dataset?.HBstatus;
	}
}

function getDetectionQueue() {
	return detectionQueue;
}
export { attachObserversListener, STATUSES, getDetectionQueue };
