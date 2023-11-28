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

const handleVideoDetection = async (request, sender, sendResponse) => {
	// add video to queue
	// in the then block, send response
	// in the catch block, send error
};

const start = () => {
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.type === "imageDetection") {
			console.log("image detection request", new Date().getTime());
			handleImageDetection(request, sender, sendResponse);
		} else if (request.type === "videoDetection") {
			handleVideoDetection(request, sender, sendResponse);
		}
		return true;
	});
};

const detectImage = async (img) => {
	console.log("offscreen detect image", img.width, img.height);
	const tensor = await human.tf.browser.fromPixelsAsync(img);
	console.log("tensors count", human.tf.memory().numTensors);
	const expanded = human.tf.expandDims(tensor, 0);
	// console.log("offscreen tensor", tensor);
	const nsfwResult = await nsfwModelClassify(expanded);
	// console.log("offscreen nsfw result", nsfwResult);
	if (containsNsfw(nsfwResult, settings.strictness)) {
		human.tf.dispose([tensor, expanded]);
		return "nsfw";
	}
	const predictions = await humanModelClassify(tensor);
	// console.log("offscreen human result", predictions);
	human.tf.dispose([tensor, expanded]);
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
