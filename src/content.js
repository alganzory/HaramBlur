import Human, { Config } from "@vladmandic/human";
import plimit from "p-limit";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const limit = plimit(10);

var intersectionObserver, mutationObserver;
const MAX_HEIGHT = 300;
const MAX_WIDTH = 500;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

/**
 * @type {Config}
 */
const config = {
	modelBasePath: modelsUrl,
	debug: false,
	// warmup: "face",
	face: {
		enabled: true,
		// async: true,
		modelPath: "blazeface.json",
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: { maxDetected: 3 },
	},
	body: {
		enabled: false,
	},
	hand: {
		enabled: false,
	},
	gesture: {
		enabled: false,
	},
	object: {
		enabled: false,
	},
};

var human;

const initHuman = async () => {
	console.log("INIT HUMAN", document.readyState);
	human = new Human(config);
	await human.load();
};

initHuman().catch((error) => {
	console.error("Error initializing Human:", error);
});

const isImageTooSmall = (img) => {
	const isSmall = img.width < MIN_WIDTH || img.height < MIN_HEIGHT;
	if (isSmall) {
		img.dataset.isSmall = true;
		return true;
	}
};

const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		if (img.complete) {
			img.dataset.complete = true;
			resolve(img);
		} else {
			img.onload = () => {
				img.dataset.onload = true;
				resolve(img);
			};
			img.onerror = (e) => {
				console.error("Failed to load image", img);
				reject(e);
			};
		}
	});
};

const calcResize = (img) => {
	// if image is smaller than max size, return null;
	if (img.width < MAX_WIDTH && img.height < MAX_HEIGHT) return null;

	// calculate new width to resize image to
	const ratio = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height);
	const newWidth = img.width * ratio;
	const newHeight = img.height * ratio;

	return { newWidth, newHeight };
};

const processImage = async (img) => {
	let loadedImage = await loadImage(img);
	if (!loadedImage) {
		console.error("Failed to load image", img);
		return;
	}
	if (isImageTooSmall(loadedImage)) return;

	const needToResize = calcResize(loadedImage);

	let detections = needToResize
		? await human.detect(loadedImage, {
				filter: {
					enabled: true,
					width: needToResize.newWidth,
					height: needToResize.newHeight,
					return: true,
				},
		  })
		: await human.detect(loadedImage);

	await processDetections(detections, img);
};

const processDetections = async (detections, img) => {
	if (!detections?.face?.length) {
		// console.log("skipping cause no faces", img);
		img.dataset.blurred = "no face";
		return;
	}

	// console.log("detections", detections);

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) => detection.gender === "female"
	);
	if (!containsWoman) {
		// console.log("skipping cause not a woman", img);
		img.dataset.blurred = " no women";
		return;
	}

	img.style.filter = "blur(10px) grayscale(100%)";
	// filter transition
	img.style.transition = "filter 0.1s ease";
	img.style.opacity = "unset";

	img.dataset.blurred = true;

	//   scroll to image
	//   img.scrollIntoView({ behavior: "smooth", block: "center" });
};

const shouldProcessImage = (img) => {
	if (img.dataset.processed) return false;
	img.dataset.processed = true;
	return true;
};

const detectFace = async (img) => {
	if (!shouldProcessImage(img)) return;

	img.crossOrigin = "anonymous";

	await processImage(img);
};

const initIntersectionObserver = async () => {
	intersectionObserver = new IntersectionObserver(
		(entries) => {
			const visibleEntries = entries.filter(
				(entry) => entry.isIntersecting
			);
			const visiblePromises = visibleEntries.map((entry) =>
				limit(async () => {
					const img = entry.target;
					intersectionObserver.unobserve(img);
					return detectFace(img);
				})
			);

			Promise.allSettled(visiblePromises);
		},
		{ rootMargin: "100px", threshold: 0 }
	);

	const images = document.getElementsByTagName("img");

	for (let img of images) {
		intersectionObserver.observe(img);
	}
};

const processNode = (node) => {
	if (node.tagName === "IMG") {
		// console.log("IMG TAG", node);

		intersectionObserver.observe(node);
		return;
	}

	node?.childNodes?.forEach((child) => processNode(child));
};

const initMutationObserver = async () => {
	mutationObserver = new MutationObserver((mutations) => {
		// if mutation is childList

		mutations.forEach((mutation) => {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					processNode(node);
				});
			}
		});
	});

	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
};

const init = async () => {
	console.log("INIT");

	await initIntersectionObserver();
	await initMutationObserver();
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init().catch((error) => {
		console.error("Error initializing:", error);
	});
}
