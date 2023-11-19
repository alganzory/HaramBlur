// observers.js
// This module exports mutation observer and image processing logic.

import { runDetection } from "./processing.js"; // import the runDetection function from processing.js
import { emitEvent, listenToEvent, processNode } from "./helpers.js";
import { shouldDetect } from "./settings.js";
import { applyBlurryStart } from "./style.js";

const BATCH_SIZE = 20; //TODO: make this a setting/calculated based on the device's performance

let mutationObserver;
let detectionQueue = [];
let observationStarted = false;
let activePromises = 0;

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

const handleImage = async (img) => {
	try {
		await runDetection(img);
	} catch (err) {
		// console.error(err, img); //TODO: enable logging in debug mode
	} finally {
		activePromises--;
		processNextImage(); // Start processing the next image
	}
};

const processNextImage = async () => {
	while (activePromises < BATCH_SIZE) {
		let nextImage = detectionQueue.shift();
		if (nextImage) {
			activePromises++;
			handleImage(nextImage);
		} else {
			break;
		}
	}
};

const addToQueue = (node) => {
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.PROCESSING)
		return; // if the element is already being processed, return
	detectionQueue.push(node);
	node.dataset.HBstatus = STATUSES.QUEUED;
};

const startObservation = () => {
	if (observationStarted) return;
	observationStarted = true;
	emitEvent("observationStarted");
};

const initMutationObserver = async () => {
	mutationObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					processNode(node, observeNode);
				});
			} else if (mutation.type === "attributes") {
				// if the src attribute of an image or video changes, process it
				const node = mutation.target;
				observeNode(node);
			}
		});

		shouldDetect() && processNextImage();
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

	shouldDetect() && processNextImage();
};

const attachObserversListener = () => {
	listenToEvent("toggleOnOffStatus", async () => {
		// console.log("HB== Observers Listener", shouldDetect());
		if (shouldDetect()) {
			initMutationObserver();
		} else {
			// console.log("HB== Observers Listener", "disconnecting");
			mutationObserver?.disconnect();
		}
	});
};

function observeNode(node) {
	// if the node is already being processed, return
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.QUEUED && node.dataset.HBstatus < STATUSES.PROCESSED)
		return;

	startObservation();

	// apply blurry start if the node wasn't already processed
	applyBlurryStart(node);

	node.dataset.HBstatus = STATUSES.OBSERVED;
	if (node.src) {
		// if there's no src attribute yet, wait for the mutation observer to catch it
		return addToQueue(node);
	} else {
		// remove the HBstatus if the node has no src attribute
		delete node.dataset?.HBstatus;
	}
}
export { attachObserversListener, STATUSES };
