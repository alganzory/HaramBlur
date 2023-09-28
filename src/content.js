import Human from "@vladmandic/human";
import plimit from "p-limit";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const limit = plimit(10);

var intersectionObserver, mutationObserver;
const MAX_IMG_HEIGHT = 300;
const MAX_IMG_WIDTH = 500;
const MIN_IMG_WIDTH = 100;
const MIN_IMG_HEIGHT = 100;

// maintain 1920x1080 aspect ratio
const MAX_VID_HEIGHT = 480;
const MAX_VID_WIDTH = 640;
const MIN_VID_WIDTH = 320;
const MIN_VID_HEIGHT = 240;

/**
 * @type {import("@vladmandic/human").Config}
 */
const config = {
	modelBasePath: modelsUrl,
	debug: false,
	cacheSensitivity: 0,
	warmup: "none",
	face: {
		enabled: true,
		// async: true,
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: { modelPath: "blazeface-front.json", maxDetected: 2 },
		// description: {enabled: false},
		description: { enabled: true, modelPath: "faceres.json" },
		// gear: { enabled: true, modelPath: "gear.json" },
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
	const isSmall = img.width < MIN_IMG_WIDTH || img.height < MIN_IMG_HEIGHT;
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

const calcResize = (element, maxWidth = MAX_IMG_WIDTH, maxHeight = MAX_IMG_HEIGHT) => {
	// if image is smaller than max size, return null;
	if (element.width < maxWidth && element.height < maxHeight) return null;

	// calculate new width to resize image to
	const ratio = Math.min(maxWidth / element.width, maxHeight / element.height);
	const newWidth = element.width * ratio;
	const newHeight = element.height * ratio;

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

const loadVideo = (video) => {
	return new Promise((resolve, reject) => {
		if (video.readyState >= 3) {
			video.dataset.readyState = video.readyState;
			resolve(video);
		} else {
			video.onloadeddata = () => {
				video.dataset.onloadeddata = true;
				resolve(video);
			};
			video.onerror = (e) => {
				console.error("Failed to load video", video);
				reject(e);
			};
		}
	});
};

const processVideoDetections = async (detections, video) => {
	if (!detections?.face?.length) {
		// console.log("skipping cause no faces", img);
		video.dataset.blurred = "no face";

		// remove blur class
		video.classList.remove("fb-blur");
		return;
	}

	console.log("detections", detections.face, video);

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) => detection.gender === "female"
	);
	if (!containsWoman) {
		// remove blur class
		video.classList.remove("fb-blur");

		return;
	}

	video.dataset.blurred = true;

	// blur current frame
	video.classList.add("fb-blur");
};

const videoDetectionLoop = async (video) => {
	const needToResize = calcResize(video, MAX_VID_WIDTH, MAX_VID_HEIGHT);
	
	if (!video.paused) {
		let detections = await human.detect(video,  {
			cacheSensitivity: 0.7,
			filter: {
				enabled: true,
				width: needToResize?.newWidth,
				height: needToResize?.newHeight,
				return: true,
			},
		});
		console.log("video detections", detections);

		await processVideoDetections(detections, video);
	}

	requestAnimationFrame(() => videoDetectionLoop(video));
};

const processVideo = async (video) => {
	let loadedVideo = await loadVideo(video);
	if (!loadedVideo) {
		console.error("Failed to load video", video);
		return;
	}

	videoDetectionLoop(loadedVideo);
};

const processDetections = async (detections, img) => {
	if (!detections?.face?.length) {
		// console.log("skipping cause no faces", img);
		img.dataset.blurred = "no face";
		return;
	}

	console.log("detections", detections.face, img);

	detections = detections.face;

	let containsWoman = detections.some(
		(detection) => detection.gender === "female"
	);
	if (!containsWoman) {
		// console.log("skipping cause not a woman", img);
		img.dataset.blurred = " no women";
		return;
	}

	img.dataset.blurred = true;

	// add blur class
	img.classList.add("fb-blur");
};

const shouldProcessImage = (img) => {
	if (img.dataset.processed) return false;
	img.dataset.processed = true;
	return true;
};

const detectFace = async (element) => {
	if (!shouldProcessImage(element)) return;

	element.crossOrigin = "anonymous";

	if (element.tagName === "IMG") {
		await processImage(element);
	} else if (element.tagName === "VIDEO") {
		await processVideo(element);
	}
};

const initIntersectionObserver = async () => {
	intersectionObserver = new IntersectionObserver(
		(entries) => {
			const visibleEntries = entries.filter(
				(entry) => entry.isIntersecting
			);
			const visiblePromises = visibleEntries.map((entry) =>
				limit(async () => {
					const imgOrVideo = entry.target;
					intersectionObserver.unobserve(imgOrVideo);
					return detectFace(imgOrVideo);
				})
			);

			Promise.allSettled(visiblePromises);
		},
		{ rootMargin: "100px", threshold: 0 }
	);

	const images = document.getElementsByTagName("img");
	const videos = document.getElementsByTagName("video");
	for (let img of images) {
		intersectionObserver.observe(img);
	}
	for (let video of videos) {
		intersectionObserver.observe(video);
	}
};

const processNode = (node, callBack) => {
	if (node.tagName === "IMG" || node.tagName === "VIDEO") {
		// console.log("IMG TAG", node);
		callBack(node);
		return;
	}

	node?.childNodes?.forEach((child) => processNode(child, callBack));
};

const initMutationObserver = async () => {
	mutationObserver = new MutationObserver((mutations) => {
		// if mutation is childList

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

const initStyles = () => {
	const style = document.createElement("style");
	style.innerHTML = `
		.fb-blur {
			filter: blur(10px) grayscale(100%);
			transition: filter 0.1s ease;
			opacity: unset;
		}

		.fb-blur:hover {
			filter: blur(0px) grayscale(0%);
			transition: filter 0.1s ease;
		}
	`;
	document.head.appendChild(style);
};

const init = async () => {
	console.log("INIT");

	await initIntersectionObserver();
	await initMutationObserver();
	initStyles();
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init().catch((error) => {
		console.error("Error initializing:", error);
	});
}
