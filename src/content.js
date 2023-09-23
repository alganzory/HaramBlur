import Human from "@vladmandic/human";
import plimit from "p-limit";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const limit = plimit(10);

var count = 0;
const config = {
	modelBasePath: modelsUrl,
	// backend: "webgpu",
	face: {
		enabled: true,
		modelPath: "blazeface.json",
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: { maxDetected: 3 },
		// description: { enabled: true, modelPath: "faceres.json" },
	},

	// disable all other models
	// except face
	// to save resources
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

var human; // global variable to hold human object
var intersectionObserver, mutationObserver;

const MAX_HEIGHT = 300;
const MAX_WIDTH = 500;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

const initHuman = async () => {
	human = new Human(config);
	await human.load();
};

initHuman().catch((error) => {
	console.error("Error initializing Human:", error);
});

const imageQueue = new Set();

const initIntersectionObserver = async () => {
	intersectionObserver = new IntersectionObserver((entries) => {
		const intersectingEntries = [];
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				// If the image is in view, check if it's in the queue
				imageQueue.delete(entry.target);
				// Process the image immediately
				intersectingEntries.push(entry.target);
			} else {
				// If the image is not in view, add it to the queue
				imageQueue.add(entry.target);
			}
		});
		const promises = intersectingEntries.map((img) =>
			limit(() => detectFace(img))
		);
		Promise.allSettled(promises);
	});
};

const processNode = (node) => {
	if (node.tagName === "IMG") {
		// console.log("IMG TAG", node);
		limit(() => detectFace(node));
		return;
	}

	node?.childNodes?.forEach((child) => processNode(child));
};

const initMutationObserver = async () => {
	mutationObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === "childList") {
				mutation.addedNodes.forEach((node) => {
					processNode(node);
				});
			}
		});
	});
};

const isImageTooSmall = (img) => {
	return img.width < MIN_WIDTH || img.height < MIN_HEIGHT;
};

// const observeImage = (img) => {
// 	if (isImageTooSmall(img)) return;

// 	intersectionObserver.observe(img);
// };

const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		if (img.complete) {
			resolve(img);
		} else {
			img.onload = () => resolve(img);
			img.onerror = (e) => {
				console.error("Failed to load image", img);
				reject(e);
			};
		}
	});
};

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
// resize image if it's too big
const resizeImage = (img) => {
	let resizedImage = img;
	// resize image if it's too big using canvas
	if (img.height > MAX_HEIGHT || img.width > MAX_WIDTH) {
		// reset canvas
		const ratio = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height);
		canvas.width = img.width * ratio;
		canvas.height = img.height * ratio;

		ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

		// Create a new image element
		resizedImage = new Image();
		resizedImage.src = canvas.toDataURL();
	}
	return resizedImage;
};

const processImage = async (img) => {
	if (isImageTooSmall(img)) return;

	// resize image if it's too big

	// check if image is loaded, print error if not
	let loadedImage = await loadImage(img);
	if (!loadedImage) {
		console.error("Failed to load image", img);
		return;
	}

	// resize image if it's too big
	loadedImage = resizeImage(loadedImage);

	let detections = await human.detect(loadedImage);
	// console.log("detections", detections);
	// return;

	if (!detections?.face?.length) {
		console.log("skipping cause no faces", img);

		return;
	}

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) => detection.gender === "female"
	);
	if (!containsWoman) {
		console.log("skipping cause not a woman", img);
		return;
	}

	img.style.filter = "blur(10px) grayscale(100%)";
	img.style.transition = "all 0.1s ease";
	img.style.opacity = "unset";
	// console.log("count ", count++);
	// scroll to image
	// img.scrollIntoView({ behavior: "smooth", block: "center" });
};

const detectFace = async (img) => {
	img.crossOrigin = "anonymous";

	await processImage(img);
};

let processingQueue = [];
var intervalId;

const processImageQueue = () => {
	// If a callback is already pending or the queue is empty, do nothing
	if (!processingQueue.length || imageQueue.size === 0) return;

	window.requestIdleCallback(() => {
		console.log("idle callback");
		// run some of the queue
		const length = Math.min(imageQueue.size, 5);

		// add to processing queue
		// and when proceesing queue length is min of 5 and image queue size (enough length to parall process)
		// then  process the queue
		for (let i = 0; i < length; i++) {
			processingQueue.push(imageQueue.values().next().value);
			imageQueue.delete(processingQueue[i]);
		}

		const promises = processingQueue.map((img) =>
			limit(() => detectFace(img))
		);
		Promise.allSettled(promises).then(() => {
			processingQueue = [];
		});

		// Check if there are more images to process
		if (imageQueue.length > 0) {
			processImageQueue();
		}
	});
};

const init = async () => {
	console.log("INITaa");
	// await initHuman();
	// await initIntersectionObserver();
	await initMutationObserver();

	// intervalId = setInterval(() => {
	// 	processImageQueue();
	// }, 500);

	// observe all images on the page
	const images = document.getElementsByTagName("img");
	console.log("images", images);

	Array.from(images).forEach((img) => {
		limit(() => detectFace(img));
	});

	// Array.from(images).forEach((img) => {
	// 	observeImage(img);
	// });

	mutationObserver.observe(document.body, { childList: true, subtree: true });
};

init().catch((error) => {
	console.error("Error initializing:", error);
});
