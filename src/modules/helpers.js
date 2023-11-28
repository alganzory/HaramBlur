// import { STATUSES } from "./observers";

const MAX_IMG_HEIGHT = 300;
const MAX_IMG_WIDTH = 400;
const MIN_IMG_WIDTH = 64;
const MIN_IMG_HEIGHT = 64;
// maintain 1920x1080 aspect ratio
const MAX_VIDEO_WIDTH = 1920 / 4;
const MAX_VIDEO_HEIGHT = 1080 / 4;

const loadImage = async (imgSrc, imgWidth, imgHeight) => {

	// let { newWidth, newHeight } = calcResize(imgWidth, imgHeight);
	// TODO: use the newWidth and newHeight to resize the image (for some reason it's a lot slower when I do that)
	const img = new Image(	
		224,
		224
	);
	return await new Promise((resolve, reject) => {
		img.setAttribute("crossorigin", "anonymous");

		img.onload = () => {
			resolve(img);
		};

		img.onerror = (e) => {
			reject(e);
		};

		try {
			img.src = imgSrc;
		} catch (e) {
			reject(e);
		}
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

const calcResize = (width, height, type = "image") => {
	let newWidth= width; 
	let newHeight = height;

	if (!width || !height) return { newWidth, newHeight };
	

	let actualMaxWidth = type === "image" ? MAX_IMG_WIDTH : MAX_VIDEO_WIDTH;
	let actualMaxHeight = type === "image" ? MAX_IMG_HEIGHT : MAX_VIDEO_HEIGHT;


	// if the aspect ratio is reversed (portrait image/video), swap max width and max height
	if (newWidth < newHeight) {
		const temp = actualMaxWidth;
		actualMaxWidth = actualMaxHeight;
		actualMaxHeight = temp;
	}

	// if image is smaller than max size, don't resize
	if (!(newWidth < actualMaxWidth && newHeight < actualMaxHeight)) {
			
	// calculate new width to resize image to
	const ratio = Math.min(
		actualMaxWidth / newWidth,
		actualMaxHeight / newHeight
	);
	newWidth = newWidth * ratio;
	newHeight = newHeight * ratio;
	}

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
	// if the node has any images or videos as children, add them to the array
	const imgs = node?.getElementsByTagName?.("img") ?? [];

	const videos = node?.getElementsByTagName?.("video") ?? [];

	// process each image/video
	// nodes that don't get callback (observed) are:
	// 1. images
	// 1.1. that are too small (but we have to make sure they have loaded first, cause they might be too small because they haven't loaded yet)

	for (let i = 0; i < imgs.length + videos.length; i++) {
		const node = i < imgs.length ? imgs[i] : videos[i - imgs.length];
		if (node.tagName === "VIDEO") {
			callBack(node);
		} else if (node.tagName === "IMG") {
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
	isImageTooSmall,
}
