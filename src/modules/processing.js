// processing.js
// This module exports the image and video processing functions

import { NSFW_CLASSES, human, nsfwModelClassify } from "./detector.js"; // import the human variable from detector.js
import {
	loadImage,
	loadVideo,
	calcResize,
	hasBeenProcessed,
	emitEvent,
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

const containsNsfw = (nsfwDetections) => {
	if (!nsfwDetections?.length) return false;
	let highestNsfwDelta = 0;
	let highestSfwDelta = 0;

	nsfwDetections.forEach((det) => {
		if (NSFW_CLASSES[det.id].nsfw) {
			highestNsfwDelta = Math.max(
				highestNsfwDelta,
				det.probability - NSFW_CLASSES[det.id].thresh
			);
		} else {
			highestSfwDelta = Math.max(
				highestSfwDelta,
				det.probability - NSFW_CLASSES[det.id].thresh
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
	if (containsNsfw(nsfwDetections)) {
		img.dataset["HBblurred"] = "nsfw";
		img.classList.add("hb-blur");
		return;
	}
	if (containsGenderFace(detections)) {
		img.dataset["HBblurred"] = "face";
		img.classList.add("hb-blur");
		return;
	}

	img.dataset["HBblurred"] = "no face";
};
const processVideoDetections = async (
	detections,
	nsfwDetections = null,
	video
) => {
	detectionStarted = true;
	emitEvent("detectionStarted");

	if (containsNsfw(nsfwDetections)) {
		video.pause();

		console.log("nsfwDetections:", nsfwDetections);
		video.dataset["HBblurred"] = "nsfw";
		video.classList.add("hb-blur");
		return;
	}
	if (containsGenderFace(detections)) {
		video.dataset["HBblurred"] = "face";
		video.classList.add("hb-blur");
		return;
	}

	video.classList.remove("hb-blur");
	video.dataset["HBblurred"] = "no face";
};

const videoDetectionLoop = async (video, needToResize) => {
	// get the current timestamp
	const currTime = performance.now();

	// calculate the time difference
	const diffTime = currTime - video.dataset.HBprevTime;

	if (!video.paused && diffTime >= FRAME_LIMIT) {
		let processed = await human.image(video, true);
		const detectionPromises = [
			nsfwModelClassify(processed.tensor, human.tf),
			human.detect(processed.tensor, {
				cacheSensitivity: 0.7,
				filter: {
					enabled: true,
					width: needToResize?.newWidth,
					height: needToResize?.newHeight,
					return: true,
				},
			}),
		];
		let [nsfwDet, detections] = await Promise.allSettled(detectionPromises);

		nsfwDet = nsfwDet.value;
		detections = detections.value;

		console.log("nsfwDet:", nsfwDet);

		// console.log("HB==video detections", detections);

		// interpolate the new detections
		const interpolated = human.next(detections);

		// dispose the tensor to free memory
		human.tf.dispose(processed.tensor);
		await processVideoDetections(interpolated, nsfwDet, video);
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
		const needToResize = calcResize(img, "image");
		let processed = await human.image(img, true);
		const detectionPromises = [
			nsfwModelClassify(processed.tensor, human.tf, human.config),
			human.detect(processed.tensor),
		];
		let [nsfwDet, detections] = await Promise.allSettled(detectionPromises);

		nsfwDet = nsfwDet.value;
		detections = detections.value;

		console.log(
			"HB==NSFW detections",
			nsfwDet
				?.map((det) => det.className + " " + det.probability.toFixed(3))
				.join(", "),
			img
		);

		// console.log("HB==Human detections", detections);

		// dispose the tensor to free memory
		human.tf.dispose(processed.tensor);

		img.removeAttribute("crossorigin");
		await processImageDetections(detections, nsfwDet, img);
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
	// console.log("HB==detectFace", element, shouldDetect());
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
