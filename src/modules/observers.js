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

const processNextImage = async () => {
	let batch = [];

	// Fill the batch with high-priority images first
	while (batch.length < BATCH_SIZE && highPriorityQueue.size > 0) {
		const nextImage = highPriorityQueue.entries().next()?.value?.[0];
		nextImage.dataset.HBstatus >= STATUSES.PROCESSING // if the image is already being processed, skip it
			? null
			: batch.push(
					runDetection(nextImage).then(() => {
						// cancel the requestIdleCallback so it doesn't run after the image has been processed
						if (nextImage.dataset.ribId) {
							cancelIdleCallback(nextImage.dataset.ribId);

							// remove the id from the dataset
							delete nextImage.dataset.ribId;
						}
					})
			  );
		highPriorityQueue.delete(nextImage);
	}

	// If there's still room in the batch, fill the rest with low-priority images
	while (batch.length < BATCH_SIZE && lowPriorityQueue.size > 0) {
		const nextImage = lowPriorityQueue.entries().next()?.value?.[0];

		// push a promise that runs the runDetection function through requestIdleCallback, we also wanna store
		// the id of the requestIdleCallback in the image object so we can cancel it if the image is moved to the
		// high-priority queue
		batch.push(
			new Promise((resolve) => {
				const id = requestIdleCallback(() => {
					runDetection(nextImage).then(() => {
						// remove the id from the dataset
						delete nextImage.dataset.ribId;

						resolve();
					});
				});
				nextImage.dataset.ribId = id;
			})
		);

		lowPriorityQueue.delete(nextImage);
	}

	if (batch.length > 0) {
		await Promise.allSettled(batch);

		if (lowPriorityQueue.size > 0 || highPriorityQueue.size > 0) {
			// Call processNextImage again after all images in the batch have been processed
			processNextImage();
		}
	}
};

const increasePriority = (node) => {
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.PROCESSING)
		return; // if the image is already being processed, return
	lowPriorityQueue.delete(node);
	highPriorityQueue.add(node);
	node.dataset.HBstatus = STATUSES.QUEUED;
};

const decreasePriority = (node) => {
	if (node.dataset.HBstatus && node.dataset.HBstatus >= STATUSES.PROCESSING)
		return; // if the image is already being processed, return
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
				console.log("HB== Mutation Observer", node);
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
	
	startObservation();
	applyBlurryStart(node);
	
	node.dataset.HBstatus = STATUSES.OBSERVED;
	if (node.src) {  // if there's no src attribute yet, wait for the mutation observer to catch it
		return intersectionObserver.observe(node);
	}
}
export { attachObserversListener, STATUSES };
