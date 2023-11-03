const MAX_IMG_HEIGHT = 300;
const MAX_IMG_WIDTH = 500;
const MIN_IMG_WIDTH = 64;
const MIN_IMG_HEIGHT = 64;
// maintain 1920x1080 aspect ratio
const MAX_VIDEO_WIDTH = 1920 / 3.5;
const MAX_VIDEO_HEIGHT = 1080 / 3.5;

const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		if (img.complete && img.naturalHeight) {
			isImageTooSmall(img) ? reject() : resolve();
		} else {
			img.onload = () => {
				img.naturalHeight
					? isImageTooSmall(img)
						? reject()
						: resolve()
					: reject();
			};
			img.onerror = (e) => {
				reject(e);
			};
		}
	});
};

const loadVideo = (video) => {
	return new Promise((resolve, reject) => {
		if (video.readyState >= 3 && video.videoHeight) {
			// video.dataset.readyState = video.readyState;
			resolve();
		} else {
			video.onloadeddata = () => {
				// video.dataset.onloadeddata = true;

				video.videoHeight ? resolve() : reject();
			};
			video.onerror = (e) => {
				// console.error("Failed to load video", video);
				reject(e);
			};
		}
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
	if (element?.dataset.processed) return true;
	element.dataset.processed = true;
	return false;
};

const processNode = (node, callBack) => {
	// if the node itself is an image or video, process it
	let nodes = [];
	if (node.tagName === "IMG") {
		!isImageTooSmall(node) && nodes.push(node);
	}
	if (node.tagName === "VIDEO") {
		nodes.push(node);
	}

	node?.querySelectorAll
		? nodes.push(...node.querySelectorAll("img, video"))
		: null;
	nodes?.forEach((node) => {
		return node.tagName === "VIDEO"
			? callBack(node)
			: !isImageTooSmall(node)
			? callBack(node)
			: null;
	});
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
};
