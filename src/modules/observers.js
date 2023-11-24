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
import { applyBlurryStart } from "./style.js";

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
		let loadedNode = false;
		node.dataset.HBstatus = STATUSES.LOADING;
		if (node.tagName === "IMG") {
			loadedNode = await loadImage(node);
		} else if (node.tagName === "VIDEO") {
			loadedNode = await loadVideo(node);
		}
		if (!loadedNode) {
			node.dataset.HBstatus = STATUSES.INVALID;
			return;
		}

		flagStartQueuing(node);

		node.dataset.HBstatus = STATUSES.LOADED;
		detectionQueue.push({ node, loadedNode });
	} catch (error) {
		node.dataset.HBstatus = STATUSES.ERROR;
		// console.error("HB== handleElementLoading error", error, node);
		// throw error;
	} finally {
		activeLoading--;
		loadNextElement(); // Start loading the next image
	}
};

const handleElementProcessing = async ({ node, loadedNode }) => {
	try {
		await runDetection(node, loadedNode);
	} catch (err) {
		// console.error(err, img); //TODO: enable logging in debug mode
	} finally {
		activeProcessing--;
		processNextElement(); // Start processing the next image
	}
};

const loadNextElement = async () => {
	while (activeLoading < BATCH_SIZE * 10) {
		let nextElement = loadingQueue.shift();
		if (nextElement) {
			activeLoading++;
			handleElementLoading(nextElement);
		} else {
			break;
		}
	}
};

const processNextElement = async () => {
	while (activeProcessing < BATCH_SIZE) {
		let nextElement = detectionQueue.shift();
		if (nextElement) {
			activeProcessing++;
			handleElementProcessing(nextElement);
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
	emitEvent("queuingStarted");
};

const startObserving = () => {
	mutationObserver.observe(document, {
		childList: true,
		characterData: false,
		subtree: true,
		attributes: true,
		attributeFilter: ["src"],
	});
};

const initMutationObserver = () => {
	// if (mutationObserver) mutationObserver.disconnect();
	mutationObserver = new MutationObserver((mutations) => {
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

		shouldDetect() && loadNextElement();

		if (isDetectionReady) {
			shouldDetect() && processNextElement();
		}
	});
};

const attachObserversListener = () => {
	listenToEvent("settingsLoaded", () => {
		if (shouldDetect()) {
			startObserving();
		} else {
			mutationObserver?.disconnect();
		}
	});
	listenToEvent("toggleOnOffStatus", async () => {
		isDetectionReady = true;
		// console.log("HB== Observers Listener", shouldDetect());
		if (shouldDetect()) {
			// process all images and videos that are already in the DOM
			processNextElement();
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
	if (node.src?.length) {
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
export {
	attachObserversListener,
	initMutationObserver,
	STATUSES,
	getDetectionQueue,
};
