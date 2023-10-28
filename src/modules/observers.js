// observers.js
// This module exports the intersection observer and mutation observer functions

import { runDetection } from "./processing.js"; // import the runDetection function from processing.js
import { listenToEvent, processNode } from "./helpers.js";
import {
	shouldDetect,
	shouldDetectImages,
	shouldDetectVideos,
} from "./settings.js";

const BATCH_SIZE = 10;

let intersectionObserver;
let mutationObserver;
let highPriorityQueue = new Set();
let lowPriorityQueue = new Set();

const processNextImage = async () => {
	let batch = [];

	// Fill the batch with high-priority images first
	while (batch.length < BATCH_SIZE && highPriorityQueue.size > 0) {
		const nextImage = highPriorityQueue.entries().next();
		batch.push(nextImage.value[0]);
		highPriorityQueue.delete(nextImage.value[0]);
	}

	// If there's still room in the batch, fill the rest with low-priority images
	while (batch.length < BATCH_SIZE && lowPriorityQueue.size > 0) {
		const nextImage = lowPriorityQueue.entries().next();
		batch.push(nextImage.value[0]);
		lowPriorityQueue.delete(nextImage.value[0]);
	}

	if (batch.length > 0) {
		await Promise.allSettled(
			batch.map((imgOrVideo) => {
				// intersectionObserver.unobserve(imgOrVideo);
				return runDetection(imgOrVideo);
			})
		);

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
					processNode(node, (node) =>
						intersectionObserver.observe(node)
					);
				});
			}
		});

		processNextImage();
	});

	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});

	// process all images and videos that are already in the DOM
	processNode(document.body, (node) => intersectionObserver.observe(node));
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
