var intersectionObserver, mutationObserver;
const MAX_HEIGHT = 300;
const MAX_WIDTH = 500;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;
var canvas, ctx;
var port = chrome.runtime.connect({ name: "content" });

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

const sendImageToPort = async (img, optionalConfig) => {
	if (!canvas) return;
	canvas.width = img.width;
	canvas.height = img.height;
	ctx.drawImage(img, 0, 0);

	// get image data
	const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

	// send message to background script for detection
	const message = {
		img: Array.from(imgData.data),
		width: canvas.width,
		height: canvas.height,
		imgSrc: img.src,
	};

	if (optionalConfig) {
		message.config = optionalConfig;
	}

	port.postMessage(message);
};

const processImage = async (img) => {
	let loadedImage = await loadImage(img);
	if (!loadedImage) {
		console.error("Failed to load image", img);
		return;
	}
	if (isImageTooSmall(loadedImage)) return;

	const needToResize = calcResize(loadedImage);
	if (needToResize) {
		await sendImageToPort(loadedImage, {
			filter: {
				enabled: true,
				width: needToResize.newWidth,
				height: needToResize.newHeight,
				return: true,
			},
		});
	} else {
		// send image to port
		await sendImageToPort(loadedImage);
	}
};

const processDetections = async (detections, imgSrc) => {
	const img = document.querySelector(`img[src="${imgSrc}"]`);
	if (!img) {
		console.log("img not found", imgSrc);
		return;
	}
	if (!detections?.face?.length) {
		// console.log("skipping cause no faces", img);
		img.dataset.blurred = "no face";
		return;
	}

	// console.log("detections", detections);

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) =>
			detection.gender === "female" ||
			(detection.gender === "male" && detection.genderScore < 0.2)
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
	if (img.dataset?.processed) return false;
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
			const visiblePromises = visibleEntries.map(async (entry) => {
				const img = entry.target;
				intersectionObserver.unobserve(img);
				return detectFace(img);
			});

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

	canvas = document.createElement("canvas");
	ctx = canvas.getContext("2d", { willReadFrequently: true });

	// listen to messages from background script
	port.onMessage.addListener((msg) => {
		console.log("content.js received message", msg);

		if (msg?.type === "detections") {
			processDetections(msg.detections, msg.imgSrc);
		}
	});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init().catch((error) => {
		console.error("Error initializing:", error);
	});
}
