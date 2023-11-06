// observers.js
// This module exports the intersection observer and mutation observer functions

import { runDetection } from "./processing.js"; // import the runDetection function from processing.js
import { emitEvent, listenToEvent, processNode } from "./helpers.js";
import { shouldDetect } from "./settings.js";
import { applyBlurryStart } from "./style.js";

const BATCH_SIZE = 20; //TODO: make this a setting/calculated based on the device's performance

let intersectionObserver;
let mutationObserver;
let highPriorityQueue = new Set();
let lowPriorityQueue = new Set();
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

const handleImage = async (img, lowPriority) => {
	try {
		let thePromise;
		let timeoutId;
		const timeoutPromise = new Promise((_, reject) => {
			timeoutId = setTimeout(() => reject(new Error("Timeout")), 2000);
		});

		if (lowPriority) {
			thePromise = new Promise((resolve) => {
				const id = requestIdleCallback(() => {
					runDetection(img).then(() => {
						// cancel the requestIdleCallback so it doesn't run after the image has been processed
						if (img.dataset.ribId) {
							cancelIdleCallback(img.dataset.ribId);

							// remove the id from the dataset
							delete img.dataset.ribId;
						}
						resolve();
					});
				});
				img.dataset.ribId = id;
			});
		} else {
			thePromise = runDetection(img);
		}

		await Promise.race([thePromise, timeoutPromise]);
		clearTimeout(timeoutId);
	} catch (err) {
		// console.error(err, img); //TODO: enable logging in debug mode
	} finally {
		activePromises--;
		// cancel the requestIdleCallback so it doesn't run after the image has been processed
		if (img.dataset.ribId) {
			cancelIdleCallback(img.dataset.ribId);

			// remove the id from the dataset
			delete img.dataset.ribId;
		}
		processNextImage(); // Start processing the next image
	}
};

const processNextImage = async () => {
	while (activePromises < BATCH_SIZE) {
		let nextImage,
			lowPriority = false;
		if (highPriorityQueue.size > 0) {
			nextImage = highPriorityQueue.entries().next()?.value?.[0];
			highPriorityQueue.delete(nextImage);
		} else if (lowPriorityQueue.size > 0) {
			nextImage = lowPriorityQueue.entries().next()?.value?.[0];
			lowPriority = true;
			lowPriorityQueue.delete(nextImage);
		}
		if (nextImage) {
			activePromises++;
			handleImage(nextImage, lowPriority);
		} else {
			break;
		}
	}
};

const increasePriority = (node) => {
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.PROCESSING)
		return; // if the element is already being processed, return
	lowPriorityQueue.delete(node);
	highPriorityQueue.add(node);
	node.dataset.HBstatus = STATUSES.QUEUED;
};

const decreasePriority = (node) => {
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.PROCESSING)
		return; // if the element is already being processed, return
	highPriorityQueue.delete(node);
	lowPriorityQueue.add(node);
	node.dataset.HBstatus = STATUSES.QUEUED;
};

const startObservation = () => {
	if (observationStarted) return;
	observationStarted = true;
	emitEvent("observationStarted");
};

const initIntersectionObserver = async () => {
	intersectionObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				const node = entry.target;
				const changePriority = entry.isIntersecting
					? increasePriority
					: decreasePriority;

				changePriority(node);
			});
		},
		{ rootMargin: "100px", threshold: 0 }
	);
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
				processNode(node, observeNode);
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
			initIntersectionObserver();
			initMutationObserver();
		} else {
			// console.log("HB== Observers Listener", "disconnecting");
			intersectionObserver?.disconnect();
			mutationObserver?.disconnect();
		}
	});
};

function observeNode(node) {
	// if the node is already being processed, return
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.QUEUED)
		return;

	startObservation();

	// apply blurry start if the node wasn't already processed
	applyBlurryStart(node);

	node.dataset.HBstatus = STATUSES.OBSERVED;
	if (node.src) {
		// if there's no src attribute yet, wait for the mutation observer to catch it
		return intersectionObserver.observe(node);
	} else {
		// remove the HBstatus if the node has no src attribute
		delete node.dataset?.HBstatus;
	}
}
export { attachObserversListener, STATUSES };
