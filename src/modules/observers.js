// observers.js
// This module exports the intersection observer and mutation observer functions

import { runDetection } from "./processing.js"; // import the runDetection function from processing.js
import { emitEvent, listenToEvent, processNode } from "./helpers.js";
import { shouldDetect } from "./settings.js";
import { applyBlurryStartMode } from "./style.js";

const BATCH_SIZE = 20; //TODO: make this a setting/calculated based on the device's performance

let intersectionObserver;
let mutationObserver;
let highPriorityQueue = new Set();
let lowPriorityQueue = new Set();
let observationStarted = false;

const processNextImage = async () => {
	let batch = [];

	// Fill the batch with high-priority images first
	while (batch.length < BATCH_SIZE && highPriorityQueue.size > 0) {
		const nextImage = highPriorityQueue.entries().next()?.value?.[0];
		nextImage.dataset.processed
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

		if (lowPriorityQueue.size > 0 || highPriorityQueue.size > 0)
			processNextImage(); // Call processNextImage again after all images in the batch have been processed
	}
};

const increasePriority = (node) => {
	lowPriorityQueue.delete(node);
	highPriorityQueue.add(node);
};

const decreasePriority = (node) => {
	highPriorityQueue.delete(node);
	lowPriorityQueue.add(node);
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
					processNode(node, (node) => {
						startObservation();
						applyBlurryStartMode(node);
						return intersectionObserver.observe(node);
					});
				});
			}
		});

		shouldDetect() && processNextImage();
	});

	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});

	// process all images and videos that are already in the DOM
	processNode(document.body, (node) => {
		applyBlurryStartMode(node);
		return intersectionObserver.observe(node);
	});
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

export { attachObserversListener };
