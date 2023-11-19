// processing.js
// This module exports the image and video processing functions

import {
	getNsfwClasses,
	human,
	humanModelClassify,
	nsfwModelClassify,
} from "./detector.js"; // import the human variable from detector.js
import {
	loadImage,
	loadVideo,
	calcResize,
	hasBeenProcessed,
	emitEvent,
	now,
	timeTaken,
	resetElement,
} from "./helpers.js";
import { STATUSES } from "./observers.js";
import {
	shouldDetect,
	shouldDetectGender,
	shouldDetectImages,
	shouldDetectVideos,
	shouldDetectMale,
	shouldDetectFemale,
	strictness,
} from "./settings.js";

const FRAME_RATE = 1000 / 30; // 30 fps

// threshold for number of consecutive frames that need to be positive for the image to be considered positive
const POSITIVE_THRESHOLD = 1; //at 30 fps, this is 0.03 seconds of consecutive positive detections
// threshold for number of consecutive frames that need to be negative for the image to be considered negative
const NEGATIVE_THRESHOLD = 6; //at 30 fps, this is 0.2 seconds of consecutive negative detections

/**
 * Object containing the possible results of image processing.
 * @typedef {Object} RESULTS
 * @property {string} CLEAR - Indicates that the image is clear and safe to display.
 * @property {string} NSFW - Indicates that the image contains NSFW content and should be blurred.
 * @property {string} FACE - Indicates that the image contains a face and should be blurred.
 * @property {string} ERROR - Indicates that an error occurred during processing.
 */
const RESULTS = {
	CLEAR: "CLEAR",
	NSFW: "NSFW",
	FACE: "FACE",
	ERROR: "ERROR",
};

let detectionStarted = false;

const flagDetectionStart = () => {
	if (detectionStarted) return;
	detectionStarted = true;
	emitEvent("detectionStarted");
};

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

const containsNsfw = (nsfwDetections) => {
	if (!nsfwDetections?.length) return false;
	let highestNsfwDelta = 0;
	let highestSfwDelta = 0;

	const nsfwClasses = getNsfwClasses(strictness);
	nsfwDetections.forEach((det) => {
		if (nsfwClasses?.[det.id].nsfw) {
			highestNsfwDelta = Math.max(
				highestNsfwDelta,
				det.probability - nsfwClasses[det.id].thresh
			);
		} else {
			highestSfwDelta = Math.max(
				highestSfwDelta,
				det.probability - nsfwClasses[det.id].thresh
			);
		}
	});
	return highestNsfwDelta > highestSfwDelta;
};

const containsGenderFace = (detections) => {
	if (!detections?.face?.length) {
		return false;
	}

	const faces = detections.face;

	if (shouldDetectGender()) {
		return faces.some(
			(face) =>
				face.age > 18 && genderPredicate(face.gender, face.genderScore)
		);
	}

	return true;
};

const processImageDetections = (detections, nsfwDetections, img) => {
	flagDetectionStart();

	// Not or-ing the two conditions because we may want to add different classes in the future
	if (nsfwDetections) {
		if (containsNsfw(nsfwDetections)) {
			img.dataset.HBresult = RESULTS.NSFW;
			img.classList.remove("hb-blur-temp");
			img.classList.add("hb-blur");
			return true;
		} else return false;
	}
	if (detections && containsGenderFace(detections)) {
		img.dataset.HBresult = RESULTS.FACE;
		img.classList.remove("hb-blur-temp");
		img.classList.add("hb-blur");
		return true;
	}

	img.dataset.HBresult = RESULTS.CLEAR;
	img.classList.remove("hb-blur");
	img.classList.remove("hb-blur-temp");
	return false;
};

const processVideoDetections = (detections, nsfwDetections = null, video) => {
	flagDetectionStart();
	const prevResult = video.dataset.HBresult;
	const isPrevResultClear = prevResult === RESULTS.CLEAR ? 1 : 0;
	const currentPositiveCount = parseInt(video.dataset.positiveCount ?? 0);
	const currentNegativeCount = parseInt(video.dataset.negativeCount ?? 0);

	if (nsfwDetections) {
		if (containsNsfw(nsfwDetections)) {
			video.dataset.HBresult = RESULTS.NSFW;
			video.dataset.positiveCount =
				currentPositiveCount + !isPrevResultClear;
			video.dataset.negativeCount = 0;
			// if the positive count is greater than the threshold (i.e it's not a momentary blip), add the blur
			if (
				currentPositiveCount + !isPrevResultClear >=
				POSITIVE_THRESHOLD
			) {
				// video.pause()

				video.classList.remove("hb-blur-temp");
				video.classList.add("hb-blur");
				video.dataset.positiveCount = 0;
			}
			return true;
		} else return false;
	}

	if (detections && containsGenderFace(detections)) {
		video.dataset.HBresult = RESULTS.FACE;
		video.dataset.positiveCount = currentPositiveCount + !isPrevResultClear;
		video.dataset.negativeCount = 0;
		// if the positive count is greater than the threshold (i.e it's not a momentary blip), add the blur
		if (currentPositiveCount + !isPrevResultClear >= POSITIVE_THRESHOLD) {
			// video.pause()
			video.classList.remove("hb-blur-temp");
			video.classList.add("hb-blur");
			video.dataset.positiveCount = 0;
		}

		return true;
	}

	video.dataset.HBresult = RESULTS.CLEAR;
	video.dataset.negativeCount = currentNegativeCount + isPrevResultClear;
	video.dataset.positiveCount = 0;
	// if the negative count is greater than the threshold (i.e it's not a momentary blip), remove the blur
	if (currentNegativeCount + isPrevResultClear >= NEGATIVE_THRESHOLD) {
		// video.pause()
		video.classList.remove("hb-blur");
		video.classList.remove("hb-blur-temp");
		video.dataset.negativeCount = 0;
	}
	video.dataset.HBresult = RESULTS.CLEAR;
	return false;
};

const processFrame = async (tensor, video, needToResize) => {
	let nsfwDet = await nsfwModelClassify(tensor);
	const positiveDet = processVideoDetections(null, nsfwDet, video);
	// console.log("nsfwDet:", nsfwDet, video);
	if (!positiveDet) {
		// only run human detection if nsfw detection is negative
		let detections = await humanModelClassify(tensor, needToResize);
		// console.log("HB==video detections", detections);
		// interpolate the new detections
		const interpolated = human.next(detections);
		processVideoDetections(interpolated, null, video);
		human.tf.dispose(tensor);
	}
};

const videoDetectionLoop = async (video, needToResize) => {
	// get the current timestamp
	const currTime = now();

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	let tensor;
	if (!video.paused) {
		try {
			if (diffTime >= FRAME_RATE) {
				tensor = (await human.image(video, true))?.tensor;
				if (!tensor) return;
				await processFrame(tensor, video, needToResize);
				// store the current timestamp
				video.dataset.HBprevTime = currTime;
			}
		} catch (error) {
			// console.log("HB==Video detection loop error", error, video);
			cancelAnimationFrame(video.dataset.HBrafId);
			video.dataset.HBerrored = true;
		} finally {
			if (tensor) human.tf.dispose(tensor.tensor);
			// console.log("number tensors video", human.tf.memory().numTensors);
		}
	}

	if (video.dataset.HBerrored) {
		// remove onplay listener
		video.onplay = null;
		video.removeAttribute("crossorigin");
		return;
	}
	if (!video.paused) {
		video.dataset.HBrafId = requestAnimationFrame(() =>
			videoDetectionLoop(video, needToResize)
		);
	} else {
		video.onplay = () => {
			video.dataset.HBrafId = requestAnimationFrame(() =>
				videoDetectionLoop(video, needToResize)
			);
		};
	}
};

const processImage = async (img) => {
	let tensor;
	try {
		img.dataset.HBstatus = STATUSES.LOADING;
		const validImage = await loadImage(img);
		if (!validImage) return false;
		img.dataset.HBstatus = STATUSES.LOADED;
		const needToResize = calcResize(img, "image");
		tensor = (await human.image(img, true))?.tensor;

		let nsfwDet = await nsfwModelClassify(tensor);
		const positiveDet = processImageDetections(null, nsfwDet, img);

		if (!positiveDet) {
			let detections = await humanModelClassify(tensor, needToResize);
			// console.log("HB==Human detections", detections, img);

			processImageDetections(detections, null, img);
		}
		return true;
	} catch (error) {
		throw error;
	} finally {
		if (tensor) human.tf.dispose(tensor);
		// console.log("number tensors", human.tf.memory().numTensors);

		img.removeAttribute("crossorigin");
	}
};

const processVideo = async (video) => {
	try {
		video.dataset.HBstatus = STATUSES.LOADING;
		await loadVideo(video);

		video.dataset.HBstatus = STATUSES.LOADED;
		const needToResize = calcResize(video, "video");
		video.dataset.HBprevTime = 0;
		videoDetectionLoop(video, needToResize);
	} catch (error) {
		throw err;
	} finally {
		video.removeAttribute("crossorigin");
	}
};

const runDetection = async (element) => {
	try {
		if (!shouldDetect()) return; // safe guard
		if (hasBeenProcessed(element)) return; // if the element has already been processed, return
		element.dataset.HBstatus = STATUSES.PROCESSING;

		// set crossorigin attribute to anonymous to avoid CORS issues
		element.setAttribute("crossorigin", "anonymous");
		if (element.tagName === "IMG" && shouldDetectImages) {
			await processImage(element);
		} else if (element.tagName === "VIDEO" && shouldDetectVideos) {
			await processVideo(element);
		}

		// if the element was successfully processed, set its status to processed
		element.dataset.HBstatus = STATUSES.PROCESSED;
	} catch (error) {
		// console.error("HumanBlur ==> Detection error: ", error, element);
		element.dataset.HBstatus = STATUSES.ERROR;
		resetElement(element);
		throw error;
	}
};

// export the image and video processing functions
export { runDetection, RESULTS };
