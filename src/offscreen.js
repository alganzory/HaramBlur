import {
	human,
	nsfwModel,
	initHuman,
	initNsfwModel,
	humanModelClassify,
	nsfwModelClassify,
	containsNsfw,
	containsGenderFace,
} from "./modules/detector.js";
import Queue from "./modules/queues.js";

// 4. define handleVideoDetection
var settings;
var queue;

const loadSettings = async () => {
	settings = await chrome.runtime.sendMessage({ type: "getSettings" });
};

const loadModels = async () => {
	try {
		await initHuman();
		await initNsfwModel();
	} catch (e) {
		console.log("Error loading models", e);
	}
};

const handleImageDetection = (request, sender, sendResponse) => {
	queue.add(
		request.image,
		(result) => {
			sendResponse(result);
		},
		(error) => {
			sendResponse(error);
		}
	);
};
let activeFrame = false;

const handleVideoDetection = async (request, sender, sendResponse) => {
	const { frame } = request;
	const { data, timestamp } = frame;
	if (activeFrame) {
		sendResponse({ result: "skipped" });
		return;
	}
	activeFrame = true;
	const imageData = new Image();
	imageData.onload = () => {
		detectImage(imageData)
			.then((result) => {
				activeFrame = false;
				sendResponse({ type: "detectionResult", result, timestamp });
			})
			.catch((e) => {
				console.log("HB== error in detectImage", e);
				activeFrame = false;
				sendResponse({ result: "error" });
			});
	};
	imageData.onerror = (e) => {
		console.log("HB== image error", e);
		activeFrame = false;
		sendResponse({ result: "error" });
	};
	imageData.src = data;
};

const start = () => {
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.type === "imageDetection") {
			handleImageDetection(request, sender, sendResponse);
		}
		if (request.type === "videoDetection") {
			handleVideoDetection(request, sender, sendResponse);
		}
		return true;
	});
};

const detectImage = async (img) => {
	const tensor = human.tf.browser.fromPixels(img);
	// console.log("tensors count", human.tf.memory().numTensors);
	const nsfwResult = await nsfwModelClassify(tensor);
	// console.log("offscreen nsfw result", nsfwResult);
	if (containsNsfw(nsfwResult, settings.strictness)) {
		human.tf.dispose(tensor);
		return "nsfw";
	}
	const predictions = await humanModelClassify(tensor);
	// console.log("offscreen human result", predictions);
	human.tf.dispose(tensor);
	if (containsGenderFace(predictions, settings.blurMale, settings.blurFemale))
		return "face";
	return false;
};

const init = async () => {
	await loadSettings();
	console.log("Settings loaded", settings);
	await loadModels();
	console.log("Models loaded", human, nsfwModel);
	queue = new Queue(detectImage);
	start();
};

init();
