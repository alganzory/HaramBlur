// processing.js
// This module exports the image and video processing functions

import { human } from "./detector.js"; // import the human variable from detector.js
import {
	loadImage,
	loadVideo,
	isImageTooSmall,
	calcResize,
	hasBeenProcessed,
} from "./helpers.js";
import {
	shouldDetect,
	shouldDetectGender,
	shouldDetectImages,
	shouldDetectVideos,
	shouldDetectMale,
	shouldDetectFemale,
} from "./settings.js";

const FRAME_LIMIT = 1000 / 30; // 30 fps

const genderPredicate = (gender, score) => {
	if (shouldDetectMale && shouldDetectFemale) return gender !== "unknown";

	if (shouldDetectMale && !shouldDetectFemale) {
		return (
			(gender === "male" && score > 0.3) ||
			(gender === "female" && score < 0.2)
		);
	}
	if (!shouldDetectMale && shouldDetectFemale) {
		return gender === "female";
	}

	return false;
};

const processImageDetections = async (detections, img) => {
	if (!detections?.face?.length) {
		console.log(
			"HB== no face detected",
			detections,
			img,
			img.complete,
			img.naturalWidth,
			img.naturalHeight
		);
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
		// console.error("Failed to load image", img);
		img.removeAttribute("crossorigin");
		return;
	}

	try {
		if (isImageTooSmall(img)) return;
		const needToResize = calcResize(img, "image");
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
	} catch (error) {
		console.error("HB==Failed to run detection", img, error);
		img.removeAttribute("crossorigin");
		return;
	}
};

const processVideo = async (video) => {
	try {
		await loadVideo(video);
	} catch (err) {
		console.error("Failed to load video", video);
		video.removeAttribute("crossorigin");
		return;
	}

	const needToResize = calcResize(video, "video");
	video.dataset.HBprevTime = 0;
	videoDetectionLoop(video, needToResize);
};

const detectFace = async (element) => {
	console.log("HB==detectFace", element, shouldDetect());
	if (!shouldDetect()) return; // safe guard
	if (!hasBeenProcessed(element)) return;

	element.crossOrigin = "anonymous";
	if (element.tagName === "IMG" && shouldDetectImages) {
		await processImage(element);
	} else if (element.tagName === "VIDEO" && shouldDetectVideos) {
		await processVideo(element);
	}
};

// export the image and video processing functions
export { detectFace };
