import { calcResize, loadVideo } from "./helpers";

const offscreenCanvas = new OffscreenCanvas(224, 224);

const FRAME_RATE = 1000 / 25; // 25 fps
const MAX_VIDEO_WIDTH = 1920 / 4;
const MAX_VIDEO_HEIGHT = 1080 / 4;

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

const processImage = (node, STATUSES) => {
	// console.log ("first send", new Date().getTime())
	try {
		node.dataset.HBstatus = STATUSES.PROCESSING;
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
				if (response === "face" || response === "nsfw") {
					// console.log("HB== handleElementProcessing", response);
					node.classList.add("hb-blur");
					node.dataset.HBstatus = STATUSES.PROCESSED;
					node.dataset.HBresult = response;
				}
			}
		);
	} catch (e) {
		console.log("HB==ERROR", e);
	}
};

const processFrame = async (video, port, { width, height }) => {
	return await new Promise((resolve, reject) => {
		offscreenCanvas.width = width;
		offscreenCanvas.height = height;
		const offscreenCtx = offscreenCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		offscreenCtx.drawImage(video, 0, 0, width, height);
		const imageData = offscreenCtx.getImageData(0, 0, width, height);
		const videoCurrentTime = video.currentTime;
		// send image data to through the port transferable object
		port.postMessage(
			{
				type: "videoDetection",
				frame: {
					data: imageData,
					timestamp: videoCurrentTime,
				},
			},
			[imageData.data.buffer]
		);

		// const timeoutId = setTimeout(() => {
		// 	resolve({
		// 		result: video.dataset.HBresult ?? RESULTS.CLEAR,
		// 		timestamp: videoCurrentTime,
		// 		stale: true,
		// 	});
		// }, 500);
		port.onmessage = (event) => {
			// if (event?.data?.timestamp === videoCurrentTime) {
			// clearTimeout(timeoutId);
			resolve(event.data);
			// }
		};
	});
};

const videoDetectionLoop = async (video, port, { width, height }) => {
	// get the current timestamp
	const currTime = performance.now();

	if (!video.dataset.HBprevTime) {
		video.dataset.HBprevTime = currTime;
	}

	let c = document.getElementById("hb-canvas");
	if (!c) {
		c = document.createElement("canvas");
		c.id = "hb-canvas";
		c.width = width;
		c.height = height;
		c.style.position = "absolute";
		c.style.top = "0";
		c.style.left = "0";
		c.style.zIndex = 9999;

		document.body.appendChild(c);
	}

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	if (!video.paused) {
		if (diffTime >= FRAME_RATE) {
			// store the current timestamp
			video.dataset.HBprevTime = currTime;
			processFrame(video, port, { width, height })
				.then(({ result, timestamp, imgR }) => {
					console.log(
						"HB== video detection result",
						result,
						timestamp,
						video.currentTime,
						imgR
					);
					// if (video.currentTime - timestamp <= 0.5)
					processVideoDetections(result, video);
					// else {
					// 	console.log(
					// 		"discarding frame",
					// 		timestamp,
					// 		video.currentTime
					// 	);
					// }
					// draw img on canvas
					c?.getContext("2d").putImageData(imgR, 0, 0);
				})
				.catch((error) => {
					console.log("HB==Video detection loop error", error, video);
					cancelAnimationFrame(video.dataset.HBrafId);
					video.dataset.HBerrored = true;
				});
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
			videoDetectionLoop(video, port, { width, height })
		);
	} else {
		video.onplay = () => {
			video.dataset.HBrafId = requestAnimationFrame(() =>
				videoDetectionLoop(video, port, { width, height })
			);
		};
	}
};
const processVideo = async (node, STATUSES, port) => {
	try {
		node.dataset.HBstatus = STATUSES.LOADING;
		await loadVideo(node);
		node.dataset.HBstatus = STATUSES.PROCESSING;
		const { newWidth, newHeight } = calcResize(
			node.videoWidth ?? node.width,
			node.videoHeight ?? node.height,
			"video"
		);
		videoDetectionLoop(node, port, { width: newWidth, height: newHeight });
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
