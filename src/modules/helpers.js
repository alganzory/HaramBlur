import { STATUSES } from "./observers";

const MAX_IMG_HEIGHT = 300;
const MAX_IMG_WIDTH = 400;
const MIN_IMG_WIDTH = 64;
const MIN_IMG_HEIGHT = 64;
// maintain 1920x1080 aspect ratio
const MAX_VIDEO_WIDTH = 1920 / 4; 
const MAX_VIDEO_HEIGHT = 1080 / 4;

/**
 * Loads an image and returns a Promise that resolves to a boolean indicating whether the image is large enough.
 * @param {HTMLImageElement} img - The image to load.
 * @returns {Promise<boolean>} A Promise that resolves to a boolean indicating whether the image is large enough or rejects if the image fails to load.
 */
const loadImage = async (img) => {
	return await new Promise((resolve, reject) => {
		img.setAttribute("crossorigin", "anonymous");
		// set crossorigin attribute to anonymous to avoid CORS issues
		if (img.complete && img.naturalHeight) {
			isImageTooSmall(img) ? resolve(false) : resolve(img);
		}
		img.onload = () => {
			img.naturalHeight
				? isImageTooSmall(img)
					? resolve(false)
					: resolve(img)
				: reject("Image failed to load, no height");
		};
		img.onerror = (e) => {
			reject(e);
		};
	});
};

const loadVideo = (video) => {
	// TODO: check if video is too small resolve false

	return new Promise((resolve, reject) => {
		video.setAttribute("crossorigin", "anonymous");
		if (video.readyState >= 3 && video.videoHeight) {
			resolve(true);
		}
		video.onloadeddata = () => {
			video.videoHeight ? resolve(true) : reject();
		};
		video.onerror = (e) => {
			// console.error("Failed to load video", video);
			reject("Failed to load video", video);
		};
	});
};

const isImageTooSmall = (img) => {
	return img.width < MIN_IMG_WIDTH || img.height < MIN_IMG_HEIGHT;
};

const calcResize = (element, type = "image") => {
	let actualMaxWidth = type === "image" ? MAX_IMG_WIDTH : MAX_VIDEO_WIDTH;
	let actualMaxHeight = type === "image" ? MAX_IMG_HEIGHT : MAX_VIDEO_HEIGHT;

	let elementWidth =
		type === "video" ? element.videoWidth : element.naturalWidth;
	let elementHeight =
		type === "video" ? element.videoHeight : element.naturalHeight;

	// if the aspect ratio is reversed (portrait image/video), swap max width and max height
	if (elementWidth < elementHeight) {
		const temp = actualMaxWidth;
		actualMaxWidth = actualMaxHeight;
		actualMaxHeight = temp;
	}

	// if image is smaller than max size, return null;
	if (elementWidth < actualMaxWidth && elementHeight < actualMaxHeight)
		return null;

	// calculate new width to resize image to
	const ratio = Math.min(
		actualMaxWidth / elementWidth,
		actualMaxHeight / elementHeight
	);
	const newWidth = elementWidth * ratio;
	const newHeight = elementHeight * ratio;

	return { newWidth, newHeight };
};

const hasBeenProcessed = (element) => {
	if (!element) throw new Error("No element provided");
	if (
		element.dataset.HBstatus &&
		element.dataset.HBstatus >= STATUSES.PROCESSING
	)
		return true;
	return false;
};

const processNode = (node, callBack) => {
	if (node.dataset?.HBstatus && node.dataset.HBstatus >= STATUSES.PROCESSING)
		return; // if the element is already being processed, return
	let nodes = [];

	// if the node itself is an image or video, add it to the array
	if (node.tagName === "IMG") {
		// if image is too small, and has completed loading,
		// (like a 1x1 pixel image, icon, etc.) don't process it
		isImageTooSmall(node) && node.complete && node.naturalHeight
			? null
			: nodes.push(node);
	}
	if (node.tagName === "VIDEO") {
		nodes.push(node);
	}

	// if the node has any images or videos as children, add them to the array
	const imgs = node?.getElementsByTagName?.("img");
	imgs?.length && nodes.push(...imgs);
	const videos = node?.getElementsByTagName?.("video");
	videos?.length && nodes.push(...videos);

	// process each image/video
	// nodes that don't get callback (observed) are:
	// 1. images
	// 1.1. that are too small (but we have to make sure they have loaded first, cause they might be too small because they haven't loaded yet)

	for (let node of nodes) {
		if (node.tagName === "VIDEO") {
			callBack(node);
		} else if (node.tagName === "IMG") {
			// if the image is already being processed, skip it
			node.dataset?.HBstatus &&
			node.dataset.HBstatus >= STATUSES.PROCESSING
				? null
				: // if image is too small, and has completed loading,
				// (like a 1x1 pixel image, icon, etc.) don't process it
				node.complete && isImageTooSmall(node) && node.naturalHeight
				? null
				: callBack(node);
		}
	}
};

const resetElement = (element) => {
	// remove crossOrigin attribute
	element.removeAttribute("crossOrigin");
	// remove blur class
	element.classList.remove("hb-blur-temp");
	element.classList.remove("hb-blur");
};

const emitEvent = (eventName, detail = "") => {
	const event = new CustomEvent(eventName, { detail });
	document.dispatchEvent(event);
};

const listenToEvent = (eventName, callBack) => {
	document.addEventListener(eventName, callBack);
};

const now = () => {
	return performance?.now?.() || Date.now();
};

const timeTaken = (fnToRun) => {
	const beforeRun = now();
	fnToRun();
	const afterRun = now();
	return afterRun - beforeRun;
};

// fallback for requestIdleCallback
// const requestIdleCallback = (fn) => {
// 	if (window.requestIdleCallback) {
// 		return window.requestIdleCallback(fn);
// 	}
// 	const start = Date.now();
// 	return setTimeout(() => {
// 		fn({
// 			didTimeout: false,
// 			timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
// 		});
// 	}, 1);
// }

export {
	loadImage,
	loadVideo,
	calcResize,
	hasBeenProcessed,
	processNode,
	emitEvent,
	listenToEvent,
	now,
	timeTaken,
	resetElement,
};
