import Human from "@vladmandic/human";
import plimit from "p-limit";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const limit = plimit(10);

var intersectionObserver, mutationObserver;
const MAX_IMG_HEIGHT = 300;
const MAX_IMG_WIDTH = 500;
const MIN_IMG_WIDTH = 50;
const MIN_IMG_HEIGHT = 80;

// maintain 1920x1080 aspect ratio
const MAX_VID_WIDTH = 1920 / 4;
const MAX_VID_HEIGHT = 1080 / 4;

const FRAME_LIMIT = 1000 / 30; // 30 fps

var settings = {};
var hbStyleSheet;
var shouldDetectVideos = true;
var shouldDetectImages = true;
var shouldDetectMale = false;
var shouldDetectFemale = false;
var started = false;

function shouldDetectGender() {
	return shouldDetectMale || shouldDetectFemale;
}
function shouldDetect() {
	if (!shouldDetectImages && !shouldDetectVideos) return false;
	return shouldDetectGender();
}

function toggleStatus(firstTime = false) {
	if (settings.status !== true) {
		shouldDetectImages = false;
		shouldDetectVideos = false;
	} else {
		shouldDetectImages = settings.blurImages;
		shouldDetectVideos = settings.blurVideos;
		shouldDetectMale = settings.blurMale;
		shouldDetectFemale = settings.blurFemale;
	}

	setStyle();
	if (!started && !firstTime) initDetection(); // in case page loads when status is off and then status is turned on
}

function initTab() {
	getSettings().then(function () {
		console.log("HB==initTab", settings);
		toggleStatus(true);
		listenForMessages();
	});
}

initTab();

function getSettings() {
	return new Promise(function (resolve) {
		chrome.storage.sync.get(["hb-settings"], function (storage) {
			settings = storage["hb-settings"];
			resolve();
		});
	});
}

function listenForMessages() {
	chrome.runtime.onMessage.addListener(function (
		request,
		sender,
		sendResponse
	) {
		if (request.message?.type === "updateSettings") {
			updateSettings(request.message.newSetting);
		}
	});
}

const updateSettings = (newSetting) => {
	// console.log("HB==updateSettings", newSetting);
	const { key, value } = newSetting;

	// take action based on key
	switch (key) {
		case "status":
			settings.status = value;
			toggleStatus();
			break;
		case "blurAmount":
			settings.blurAmount = value;
			setStyle();
			break;
	}
};

/**
 * @type {import("@vladmandic/human").Config}
 */
const HUMAN_CONFIG = {
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
		description: {
			enabled: true,
			modelPath: "faceres.json",
		},
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
	// console.log("HB==INIT HUMAN", document.readyState);
	human = new Human(HUMAN_CONFIG);
	await human.load();
};

initHuman()
	.then(() => {
		if (!shouldDetect()) return;

		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", initDetection);
		} else {
			initDetection().catch((error) => {
				console.error("Error in Init Detection:", error);
			});
		}
	})
	.catch((error) => {
		console.error("Error initializing Human:", error);
	});

const isImageTooSmall = (img) => {
	const isSmall = img.width < MIN_IMG_WIDTH || img.height < MIN_IMG_HEIGHT;
	if (isSmall) {
		img.dataset.isSmall = true;
		return true;
	}
};

const hasBeenProcessed = (element) => {
	if (element.dataset.processed) return false;
	element.dataset.processed = true;
	return true;
};

const calcResize = (
	element,
	maxWidth = MAX_IMG_WIDTH,
	maxHeight = MAX_IMG_HEIGHT
) => {
	let actualMaxWidth = maxWidth;
	let actualMaxHeight = maxHeight;

	let elementWidth =
		element.tagName === "VIDEO" ? element.videoWidth : element.naturalWidth;
	let elementHeight =
		element.tagName === "VIDEO"
			? element.videoHeight
			: element.naturalHeight;

	// if the aspect ratio is reversed (portrait image/video), swap max width and max height
	if (elementWidth < elementHeight) {
		actualMaxWidth = maxHeight;
		actualMaxHeight = maxWidth;
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

const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		if (img.complete && img.naturalHeight) {
			resolve();
		} else {
			img.onload = resolve;
			img.onerror = reject;
		}
	});
};

const loadVideo = (video) => {
	return new Promise((resolve, reject) => {
		if (video.readyState >= 3 && video.videoHeight) {
			video.dataset.readyState = video.readyState;
			resolve();
		} else {
			video.onloadeddata = () => {
				video.dataset.onloadeddata = true;
				resolve();
			};
			video.onerror = (e) => {
				// console.error("Failed to load video", video);
				reject(e);
			};
		}
	});
};

const genderPredicate = (gender, score) => {
	const { blurMale, blurFemale } = settings;
	if (blurMale && blurFemale) return gender !== "unknown";

	if (blurMale && !blurFemale) {
		return (
			(gender === "male" && score > 0.3) ||
			(gender === "female" && score < 0.2)
		);
	}
	if (!blurMale && blurFemale) {
		return gender === "female";
	}

	return false;
};

const processImageDetections = async (detections, img) => {
	if (!detections?.face?.length) {
		// console.log(
		// 	"HB== no face detected",
		// 	detections,
		// 	img,
		// 	img.complete,
		// 	img.naturalWidth,
		// 	img.naturalHeight
		// );
		img.dataset.blurred = "no face";
		return;
	}

	detections = detections.face;

	if (shouldDetectGender()) {
		let containsGender = detections.some((detection) =>
			genderPredicate(detection.gender, detection.genderScore)
		);
		if (!containsGender) {
			img.dataset.blurred = "no gender";
			return;
		}
	}
	img.dataset.blurred = true;

	// console.log(
	// 	"HB== yes face detected",
	// 	detections,
	// 	img,
	// 	img.complete,
	// 	img.naturalWidth,
	// 	img.naturalHeight
	// );

	// add blur class
	img.classList.add("hb-blur");
};

const processVideoDetections = async (detections, video) => {
	if (!detections?.face?.length) {
		video.dataset.blurred = "no face";

		// remove blur class
		video.classList.remove("hb-blur");
		return;
	}

	detections = detections.face;

	if (shouldDetectGender()) {
		let containsGender = detections.some((detection) =>
			genderPredicate(detection.gender, detection.genderScore)
		);
		if (!containsGender) {
			// remove blur class
			video.classList.remove("hb-blur");
			video.dataset.blurred = "no gender";
			return;
		}
	}

	video.dataset.blurred = true;

	// console.log("HB==blurring video", detections);

	// blur current frame
	video.classList.add("hb-blur");
};

const videoDetectionLoop = async (video, needToResize) => {
	// get the current timestamp
	const currTime = performance.now();

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	if (!video.paused && diffTime >= FRAME_LIMIT) {
		// console.log(
		// 	"HB===video previous time",
		// 	video.dataset.HBprevTime,
		// 	"currTime",
		// 	currTime,
		// 	"diffTime",
		// 	diffTime,
		// 	"height",
		// 	video.videoHeight
		// );
		let detections = await human.detect(video, {
			cacheSensitivity: 0.7,
			filter: {
				enabled: true,
				width: needToResize?.newWidth,
				height: needToResize?.newHeight,
				return: true,
			},
		});
		// console.log("HB==video detections", detections);


		// interpolate the new detections
		const interpolated = human.next(detections);
		await processVideoDetections(interpolated, video);
		// store the current timestamp
		video.dataset.HBprevTime = currTime;
	}

	requestAnimationFrame(() => videoDetectionLoop(video, needToResize));
};

const processImage = async (img) => {
	try {
		await loadImage(img);
	} catch (err) {
		console.error("Failed to load image", img);
		img.removeAttribute("crossorigin");
		return;
	}

	if (isImageTooSmall(img)) return;

	const needToResize = calcResize(img);


	let detections = needToResize
		? await human.detect(img, {
				filter: {
					enabled: true,
					width: needToResize.newWidth,
					height: needToResize.newHeight,
					return: true,
				},
		  })
		: await human.detect(img);

	img.removeAttribute("crossorigin");
	await processImageDetections(detections, img);
};

const processVideo = async (video) => {
	try {
		await loadVideo(video);
	} catch (err) {
		console.error("Failed to load video", video);
		video.removeAttribute("crossorigin");
		return;
	}

	const needToResize = calcResize(video, MAX_VID_WIDTH, MAX_VID_HEIGHT);
	video.dataset.HBprevTime = 0;
	videoDetectionLoop(video, needToResize);
};

const detectFace = async (element) => {
	if (!shouldDetect()) return; // safe guard
	if (!hasBeenProcessed(element)) return;

	element.crossOrigin = "anonymous";

	if (element.tagName === "IMG" && shouldDetectImages) {
		await processImage(element);
	} else if (element.tagName === "VIDEO" && shouldDetectVideos) {
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

	const images = shouldDetectImages ? document.querySelectorAll("img") : [];
	const videos = shouldDetectVideos ? document.querySelectorAll("video") : [];
	for (let img of images) {
		intersectionObserver.observe(img);
	}
	for (let video of videos) {
		intersectionObserver.observe(video);
	}
};

const processNode = (node, callBack) => {
	if (node.tagName === "IMG" || node.tagName === "VIDEO") {
		// console.log("HB==IMG TAG", node);
		callBack(node);
		return;
	}

	node?.childNodes?.forEach((child) => processNode(child, callBack));
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

const initStyles = () => {
	hbStyleSheet = document.createElement("style");
	hbStyleSheet.id = "hb-stylesheet";
	setStyle();
	document.head.appendChild(hbStyleSheet);
};

const setStyle = () => {
	if (!hbStyleSheet) return;
	if (!shouldDetect()) {
		hbStyleSheet.innerHTML = "";
		return;
	}
	const shouldBlurImages = settings.blurImages;
	const shouldBlurVideos = settings.blurVideos;
	const shouldUnblurImagesOnHover = settings.unblurImages;
	const shouldUnblurVideosOnHover = settings.unblurVideos;

	let blurSelectors = [];
	if (shouldBlurImages) blurSelectors.push("img" + ".hb-blur");
	if (shouldBlurVideos) blurSelectors.push("video" + ".hb-blur");
	blurSelectors = blurSelectors.join(", ");

	let unblurSelectors = [];
	if (shouldUnblurImagesOnHover)
		unblurSelectors.push("img" + ".hb-blur:hover");
	if (shouldUnblurVideosOnHover)
		unblurSelectors.push("video" + ".hb-blur:hover");
	unblurSelectors = unblurSelectors.join(", ");
	hbStyleSheet.innerHTML = `
		${blurSelectors} {
			filter: blur(${settings.blurAmount}px) grayscale(100%);
			transition: filter 0.1s ease;
			opacity: unset;
		}

		// when hovering, gradually remove grayscale for 1 second, then gradually remove blur
		${unblurSelectors} {
			filter: grayscale(0%);
			transition: filter 0.5s ease;
		}
		${unblurSelectors} {
			filter: blur(0px);
			transition: filter 0.5s ease;
			transition-delay: 1s;
		}
	`;
};

const initDetection = async () => {
	console.log("HB==INIT");
	if (started) return;
	started = true;
	await initIntersectionObserver();
	await initMutationObserver();
	initStyles();
};
