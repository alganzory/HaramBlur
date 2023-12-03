import { calcResize, loadVideo, getCanvas, emitEvent } from "./helpers";
import { removeBlurryStart } from "./style";

const FRAME_RATE = 1000 / 25; // 25 fps

// threshold for number of consecutive frames that need to be positive for the image to be considered positive
const POSITIVE_THRESHOLD = 1; //at 25 fps, this is 0.04 seconds of consecutive positive detections
// threshold for number of consecutive frames that need to be negative for the image to be considered negative
const NEGATIVE_THRESHOLD = 5; //at 25 fps, this is 0.2 seconds of consecutive negative detections
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

let requestCount = 0;
let detectedCount = 0;
let detectionStarted = false;

const flagDetectionStart = () => {
	if (detectionStarted) return;
	// detection is marked as started when at least 1/8th of the images have been processed (arbitrary number)
	if ((detectedCount >= requestCount / 8) && !detectionStarted) {
		detectionStarted = true;
		console.log("HaramBlur: Detection started");
		emitEvent("detectionStarted");
	}
	detectedCount++;
};

const processImage = (node, STATUSES) => {
	try {
		node.dataset.HBstatus = STATUSES.PROCESSING;
		!detectionStarted && requestCount++;
		chrome.runtime.sendMessage(
			{
				type: "imageDetection",
				image: {
					src: node.src,
					width: node.width || node.naturalWidth,
					height: node.height || node.naturalHeight,
				},
			},
			(response) => {
				flagDetectionStart();
				removeBlurryStart(node);
				if (
					response === "face" ||
					response === "nsfw" ||
					response == false
				) {
					// console.log("HB== handleElementProcessing", response);
					node.dataset.HBstatus = STATUSES.PROCESSED;
					if (response === "face" || response === "nsfw") {
						node.classList.add("hb-blur");
						node.dataset.HBresult = response;
					}
				}
			}
		);
	} catch (e) {
		console.log("HB==ERROR", e);
	}
};

const processFrame = async (video, { width, height }) => {
	return await new Promise((resolve, reject) => {
		const canv = getCanvas(width, height);
		const ctx = canv.getContext("2d", {
			willReadFrequently: true,
		});
		ctx.drawImage(video, 0, 0, width, height);

		canv.toBlob((blob) => {
			let data = URL.createObjectURL(blob);
			chrome.runtime.sendMessage(
				{
					type: "videoDetection",
					frame: {
						data: data,
						timestamp: video.currentTime,
					},
				},
				(response) => {
					// revoke the object url to free up memory
					URL.revokeObjectURL(data);
					resolve(response);
				}
			);
		});
	});
};

const videoDetectionLoop = async (video, { width, height }) => {
	// get the current timestamp
	const currTime = performance.now();

	if (!video.dataset.HBprevTime) {
		video.dataset.HBprevTime = currTime;
	}

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	if (!video.paused) {
		try {
			if (diffTime >= FRAME_RATE) {
				// store the current timestamp
				video.dataset.HBprevTime = currTime;

				processFrame(video, { width, height })
					.then(({ result, timestamp }) => {
						if (result === "error") {
							throw new Error("HB==Error in processFrame");
						}

						// if frame was skipped, don't process it
						if (result === "skipped") {
							// console.log( "skipped frame");
							return;
						}

						// if the frame is too old, don't process it
						if (video.currentTime - timestamp > 0.5) {
							// console.log("too old frame");
							return;
						}

						// process the result
						processVideoDetections(result, video);
					})
					.catch((error) => {
						throw error;
					});
			}
		} catch (error) {
			console.log("HB==Video detection loop error", error, video);
			video.dataset.HBerrored =
				parseInt(video.dataset.HBerrored ?? 0) + 1;
		}
	}

	if (video.dataset.HBerrored > 10) {
		// remove onplay listener
		video.onplay = null;
		cancelAnimationFrame(video.dataset.HBrafId);
		video.removeAttribute("crossorigin");
		return;
	}
	if (!video.paused) {
		video.dataset.HBrafId = requestAnimationFrame(() =>
			videoDetectionLoop(video, { width, height })
		);
	} else {
		video.onplay = () => {
			video.dataset.HBrafId = requestAnimationFrame(() =>
				videoDetectionLoop(video, { width, height })
			);
		};
	}
};
const processVideo = async (node, STATUSES) => {
	try {
		node.dataset.HBstatus = STATUSES.LOADING;
		await loadVideo(node);
		node.dataset.HBstatus = STATUSES.PROCESSING;
		const { newWidth, newHeight } = calcResize(
			node.videoWidth ?? node.width,
			node.videoHeight ?? node.height,
			"video"
		);
		flagDetectionStart();
		removeBlurryStart(node);
		videoDetectionLoop(node, { width: newWidth, height: newHeight });
	} catch (e) {
		console.log("HB== processVideo error", e);
	}
};

const processVideoDetections = (result, video) => {
	const prevResult = video.dataset.HBresult;
	const isPrevResultClear = prevResult === RESULTS.CLEAR || !prevResult;
	const currentPositiveCount = parseInt(video.dataset.positiveCount ?? 0);
	const currentNegativeCount = parseInt(video.dataset.negativeCount ?? 0);
	let shouldBlur = null;

	if (result === "nsfw") {
		video.dataset.HBresult = RESULTS.NSFW;
		video.dataset.positiveCount = currentPositiveCount + !isPrevResultClear;
		video.dataset.negativeCount = 0;
		// if the positive count is greater than the threshold (i.e it's not a momentary blip), add the blur
		if (currentPositiveCount + !isPrevResultClear >= POSITIVE_THRESHOLD) {
			// video.pause()
			shouldBlur = true;
			video.dataset.positiveCount = 0;
		}
	} else if (result === "face") {
		video.dataset.HBresult = RESULTS.FACE;
		video.dataset.positiveCount = currentPositiveCount + !isPrevResultClear;
		video.dataset.negativeCount = 0;
		// if the positive count is greater than the threshold (i.e it's not a momentary blip), add the blur
		if (currentPositiveCount + !isPrevResultClear >= POSITIVE_THRESHOLD) {
			// video.pause()
			shouldBlur = true;
			video.dataset.positiveCount = 0;
		}
	} else {
		video.dataset.HBresult = RESULTS.CLEAR;
		video.dataset.negativeCount = currentNegativeCount + isPrevResultClear;
		video.dataset.positiveCount = 0;
		// if the negative count is greater than the threshold (i.e it's not a momentary blip), remove the blur
		if (currentNegativeCount + isPrevResultClear >= NEGATIVE_THRESHOLD) {
			shouldBlur = false;
			video.dataset.negativeCount = 0;
		}
	}

	if (shouldBlur !== null) {
		shouldBlur
			? video.classList.add("hb-blur")
			: video.classList.remove("hb-blur");
	}
};
export { processImage, processVideo };
