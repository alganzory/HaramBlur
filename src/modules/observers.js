// observers.js
// This module exports mutation observer and image processing logic.
import { listenToEvent, processNode } from "./helpers.js";

import { shouldDetect } from "./settings.js";
import { applyBlurryStart } from "./style.js";
import { processImage, processVideo } from "./processing2.js";

let mutationObserver;
let videoPort = null;

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
					processNode(node, (node) => {
						observeNode(node, false);
					});
				});
			} else if (mutation.type === "attributes") {
				// if the src attribute of an image or video changes, process it
				const node = mutation.target;
				if (node.tagName === "IMG" || node.tagName === "VIDEO")
					observeNode(node, mutation?.attributeName === "src");
			}
		});
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
		// console.log("HB== Observers Listener", shouldDetect());
		if (shouldDetect()) {
			// process all images and videos that are already in the DOM
			startObserving();
		} else {
			// console.log("HB== Observers Listener", "disconnecting");
			mutationObserver?.disconnect();
		}
	});
	listenToEvent("videoFramePort", (event) => {
		console.log("HB== videoFramePort", event.detail);
		videoPort = event.detail;
	});
};

function observeNode(node, srcAttribute) {
	const conditions =
		(srcAttribute || !node.dataset.HBstatus) &&
		node.src?.length > 0 &&
		((node.width > 32 && node.height > 32) ||
			node.height === 0 ||
			node.width === 0);

	if (!conditions) return;

	applyBlurryStart(node);

	node.dataset.HBstatus = STATUSES.OBSERVED;
	if (node.src?.length) {
		// if there's no src attribute yet, wait for the mutation observer to catch it
		node.tagName === "IMG" ? processImage(node, STATUSES) : null;
		node.tagName === "VIDEO"
			? processVideo(node, STATUSES, videoPort)
			: null;
	} else {
		// remove the HBstatus if the node has no src attribute
		delete node.dataset?.HBstatus;
	}
}

function getDetectionQueue() {
	return [];
}
export {
	attachObserversListener,
	initMutationObserver,
	STATUSES,
	getDetectionQueue,
};
