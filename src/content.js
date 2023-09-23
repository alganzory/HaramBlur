import Human from "@vladmandic/human";
import plimit from "p-limit";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const limit = plimit(10);

// var count = 0;
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
var mutationObserver;

const MAX_HEIGHT = 300;
const MAX_WIDTH = 500;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

const initHuman = async () => {
	console.log("INIT HUMAN", document.readyState);
	human = new Human(config);
	await human.load();
};

initHuman().catch((error) => {
	console.error("Error initializing Human:", error);
});

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
				// console.log("mutation", mutation.target, mutation.addedNodes);
				mutation.addedNodes.forEach((node) => {
					processNode(node);
				});
			}
		});
	});
};

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

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
// resize image if it's too big
const resizeImage = (img) => {
	if (img.height <= MAX_HEIGHT && img.width <= MAX_WIDTH) return img;

	// resize image if it's too big using canvas

	console.log("resizing");
	// reset canvas
	const ratio = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height);
	canvas.width = img.width * ratio;
	canvas.height = img.height * ratio;

	ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

	// Create a new image element
	let resizedImage = new Image();
	resizedImage.src = canvas.toDataURL();

	img.dataset.resized = true;

	return resizedImage;
};

const processImage = async (img) => {
	
	// resize image if it's too big
	
	// check if image is loaded, print error if not
	let loadedImage = await loadImage(img);
	if (!loadedImage) {
		console.error("Failed to load image", img);
		return;
	}
	if (isImageTooSmall(loadedImage)) return;

	// resize image if it's too big
	loadedImage = resizeImage(loadedImage);

	let detections = await human.detect(loadedImage);
	// console.log("detections", detections);
	// return;

	if (!detections?.face?.length) {
		console.log("skipping cause no faces", img);
		img.dataset.blurred = false;

		return;
	}

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) => detection.gender === "female"
	);
	if (!containsWoman) {
		console.log("skipping cause not a woman", img);
		img.dataset.blurred = false;
		return;
	}

	console.log("blurring image", img);

	img.style.filter = "blur(10px) grayscale(100%)";
	img.style.transition = "all 0.1s ease";
	img.style.opacity = "unset";

	img.dataset.blurred = true;
	// console.log("count ", count++);
};

const shouldProcessImage = (img) => {
	if (img.dataset.processed) return false;
	img.dataset.processed = true;
	return true;
};

const detectFace = async (img) => {
	// somehow mark image as processed
	// so that it's not processed again
	if (!shouldProcessImage(img)) return;

	img.crossOrigin = "anonymous";

	await processImage(img);
};

const init = async () => {
	console.log("INITaa");

	await initMutationObserver();

	const images = document.getElementsByTagName("img");
	// console.log("images", images);

	// const imagesArray = Array.from(images);
	for (let img of images) {
		// console.log("🚀 ~ file: content.js:261 ~ init ~ img:", img);
		limit(() => detectFace(img));
	}

	mutationObserver.observe(document.body, { childList: true, subtree: true });
};

if (document.readyState === "loading") {
	// Loading hasn't finished yet
	document.addEventListener("DOMContentLoaded", init);
} else {
	// `DOMContentLoaded` has already fired
	init().catch((error) => {
		console.error("Error initializing:", error);
	});
}
