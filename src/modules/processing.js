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

let detectionStarted = false;

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

const containsNsfw = (nsfwDetections, nsfwFactor = 0) => {
	if (!nsfwDetections?.length) return false;
	let highestNsfwDelta = 0;
	let highestSfwDelta = 0;

	const nsfwClasses = getNsfwClasses(nsfwFactor);
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
		return faces.some((face) =>
			genderPredicate(face.gender, face.genderScore)
		);
	} // only detect faces

	return true;
};

const processImageDetections = async (detections, nsfwDetections, img) => {
	if (!detectionStarted) {
		detectionStarted = true;
		emitEvent("detectionStarted");
	}

	// Not or-ing the two conditions because we may want to add different classes in the future
	if (nsfwDetections) {
		if (containsNsfw(nsfwDetections, 1)) {
			img.dataset["HBblurred"] = "nsfw";
			img.classList.add("hb-blur");
			return true;
		} else return false;
	}
	if (detections && containsGenderFace(detections)) {
		img.dataset["HBblurred"] = "face";
		img.classList.add("hb-blur");
		return true;
	}

	img.dataset["HBblurred"] = "no face";
	return false;
};
const processVideoDetections = async (
	detections,
	nsfwDetections = null,
	video
) => {
	if (!detectionStarted) {
		detectionStarted = true;
		emitEvent("detectionStarted");
	}
	if (nsfwDetections) {
		if (containsNsfw(nsfwDetections, 1)) {
			video.dataset["HBblurred"] = "nsfw";
			video.classList.add("hb-blur");
			return true;
		} else return false;
	}

	if (detections && containsGenderFace(detections)) {
		video.dataset["HBblurred"] = "face";
		video.classList.add("hb-blur");
		return true;
	}

	video.classList.remove("hb-blur");
	video.dataset["HBblurred"] = "no face";
	return false;
};

const videoDetectionLoop = async (video, needToResize) => {
	// get the current timestamp
	const currTime = now();

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	if (!video.paused) {
		try {
			if (diffTime >= FRAME_LIMIT) {
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

const processImage = async (img) => {
	try {
		await loadImage(img);
	} catch (err) {
		// console.error("Failed to load image", img);
		img.removeAttribute("crossorigin");
		return;
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
	} catch (error) {
		console.error("HB==Failed to process img", img, error);
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

	try {
		const needToResize = calcResize(video, "video");
		video.dataset.HBprevTime = 0;
		await videoDetectionLoop(video, needToResize);
	} catch (error) {
		console.error("HB==Failed to process video", video, error);
		video.removeAttribute("crossorigin");
		return;
	}
};

const runDetection = async (element) => {
	// console.log("HB==runDetection", element, shouldDetect());
	if (!shouldDetect()) return; // safe guard
	try {
		if (hasBeenProcessed(element)) return;

		// set crossorigin attribute to anonymous to avoid CORS issues
		element.setAttribute("crossorigin", "anonymous");

		if (element.tagName === "IMG" && shouldDetectImages) {
			await processImage(element);
		} else if (element.tagName === "VIDEO" && shouldDetectVideos) {
			await processVideo(element);
		}
	} catch (error) {
		console.error("HB==Failed to run detection", element, error);
	}
};

// export the image and video processing functions
export { runDetection };
