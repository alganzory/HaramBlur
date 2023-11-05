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
const NEGATIVE_THRESHOLD = 9; //at 30 fps, this is 0.3 seconds of consecutive negative detections

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

const processImageDetections = async (detections, nsfwDetections, img) => {
	flagDetectionStart();

	// Not or-ing the two conditions because we may want to add different classes in the future
	if (nsfwDetections) {
		if (containsNsfw(nsfwDetections)) {
			img.dataset.HBresult = RESULTS.NSFW;
			img.classList.add("hb-blur");
			return true;
		} else return false;
	}
	if (detections && containsGenderFace(detections)) {
		img.dataset.HBresult = RESULTS.FACE;
		img.classList.add("hb-blur");
		return true;
	}

	img.dataset.HBresult = RESULTS.CLEAR;
	img.classList.remove("hb-blur");
	return false;
};

const processVideoDetections = async (
	detections,
	nsfwDetections = null,
	video
) => {
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
		video.dataset.negativeCount = 0;
	}
	video.dataset.HBresult = RESULTS.CLEAR;
	return false;
};

const videoDetectionLoop = async (video, needToResize) => {
	// get the current timestamp
	const currTime = now();

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	if (!video.paused) {
		try {
			if (diffTime >= FRAME_RATE) {
				let processed = await human.image(video, true);

				let nsfwDet = await nsfwModelClassify(processed.tensor);
				const positiveDet = await processVideoDetections(
					null,
					nsfwDet,
					video
				);
				// console.log("nsfwDet:", nsfwDet, video);

				if (!positiveDet) {
					// only run human detection if nsfw detection is negative
					let detections = await humanModelClassify(
						processed.tensor,
						needToResize
					);
					// console.log("HB==video detections", detections);
					// interpolate the new detections
					const interpolated = human.next(detections);
					await processVideoDetections(interpolated, null, video);
				}

				// dispose the tensor to free memory
				human.tf.dispose(processed.tensor);
				// store the current timestamp
				video.dataset.HBprevTime = currTime;
			}
		} catch (error) {
			// console.log("HB==Video detection loop error", error, video);
			cancelAnimationFrame(video.dataset.HBrafId);
			video.dataset.HBerrored = true;
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

/**
 * Processes an image by loading it, resizing it if necessary, and running it through a human and NSFW model for classification.
 * @async
 * @function
 * @param {HTMLImageElement} img - The image element to process.
 * @returns {Promise<boolean>} - A Promise that resolves to true if the image was successfully processed, or false if it was not a valid image.
 * @throws {Error} - If there was an error processing the image.
 */
const processImage = async (img) => {
	try {
		img.dataset.HBstatus = STATUSES.LOADING;
		const validImage = await loadImage(img);
		if (!validImage) return false;
		img.dataset.HBstatus = STATUSES.LOADED;
	} catch (err) {
		throw err;
	}

	try {
		const needToResize = calcResize(img, "image");
		let processed = await human.image(img, true);

		let nsfwDet = await nsfwModelClassify(processed.tensor);
		const positiveDet = await processImageDetections(null, nsfwDet, img);

		if (!positiveDet) {
			let detections = await humanModelClassify(
				processed.tensor,
				needToResize
			);
			// console.log("HB==Human detections", detections, img);

			await processImageDetections(detections, null, img);
		}

		// dispose the tensor to free memory
		human.tf.dispose(processed.tensor);
		img.removeAttribute("crossorigin");

		return true;
	} catch (error) {
		throw new Error("Failed to process image", img, error);
	}
};

const processVideo = async (video) => {
	try {
		video.dataset.HBstatus = STATUSES.LOADING;
		await loadVideo(video);
		video.dataset.HBstatus = STATUSES.LOADED;
	} catch (err) {
		throw new Error("Failed to load video", video, err);
	}

	try {
		const needToResize = calcResize(video, "video");
		video.dataset.HBprevTime = 0;
		await videoDetectionLoop(video, needToResize);
	} catch (error) {
		throw new Error("Failed to process video", video, error);
	}
};

const runDetection = async (element) => {
	// console.log("HB==runDetection", element, shouldDetect());
	if (!shouldDetect()) return; // safe guard
	try {
		if (hasBeenProcessed(element)) return; // if the element has already been processed, return
		element.dataset.HBstatus = STATUSES.PROCESSING;
		let processed = false;

		// set crossorigin attribute to anonymous to avoid CORS issues
		element.setAttribute("crossorigin", "anonymous");
		if (element.tagName === "IMG" && shouldDetectImages) {
			processed = await processImage(element);
		} else if (element.tagName === "VIDEO" && shouldDetectVideos) {
			processed = await processVideo(element);
		}

		// if the element was successfully processed, set its status to processed
		if (processed) {
			element.dataset.HBstatus = STATUSES.PROCESSED;
			if (element.dataset.HBtimeoutId) { 
				clearTimeout(element.dataset.HBtimeoutId);
				delete element.dataset.HBtimeoutId;
			}
		} else {
			element.dataset.HBstatus = STATUSES.INVALID;
			resetElement(element);
		}
	} catch (error) {
		// console.error("HumanBlur ==> Detection error: ", error, element);
		element.dataset.HBstatus = STATUSES.ERROR;
		resetElement(element);
	}
};

// export the image and video processing functions
export { runDetection, RESULTS };
