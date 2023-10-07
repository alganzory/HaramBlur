// observers.js
// This module exports the intersection observer and mutation observer functions

import { detectFace } from "./processing.js"; // import the detectFace function from processing.js
import { listenToEvent, processNode } from "./helpers.js";
import {
	shouldDetect,
	shouldDetectImages,
	shouldDetectVideos,
} from "./settings.js";

let intersectionObserver;
let mutationObserver;

const initIntersectionObserver = async () => {
	intersectionObserver = new IntersectionObserver(
		(entries) => {
			const visibleEntries = entries.filter(
				(entry) => entry.isIntersecting
			);
			const visiblePromises = visibleEntries.map(async (entry) => {
				const imgOrVideo = entry.target;
				intersectionObserver.unobserve(imgOrVideo);
				return detectFace(imgOrVideo);
			});
			Promise.allSettled(visiblePromises);
		},
		{ rootMargin: "100px", threshold: 0 }
	);

	// use querySelectorAll to get all images and videos
	const images = shouldDetectImages ? document.querySelectorAll("img") : [];
	const videos = shouldDetectVideos ? document.querySelectorAll("video") : [];
	for (let img of images) {
		intersectionObserver.observe(img);
	}
	for (let video of videos) {
		intersectionObserver.observe(video);
	}
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
	});

	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
};

const attachObserversListener = () => {
	listenToEvent("toggleOnOffStatus", async () => {
		console.log("HB== Observers Listener", shouldDetect());
		if (shouldDetect()) {
			initIntersectionObserver();
			initMutationObserver();
		} else {
			console.log("HB== Observers Listener", "disconnecting");
			intersectionObserver?.disconnect();
			mutationObserver?.disconnect();
		}
	});
};

export { attachObserversListener };
