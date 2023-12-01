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
let videoPort;
window.onmessage = (e) => {
	console.log(
		"location.search ",
		new URLSearchParams(location.search).get("secret")
	);
	if (e.data === new URLSearchParams(location.search).get("secret")) {
		window.onmessage = null;
		videoPort = e.ports[0];
		videoPort.onmessage = (e) => onContentMessage(e, videoPort);
		videoPort.onmessageerror = (e) => console.log("message error", e);
	}
};

function onContentMessage(e, port) {
	if (e.data.type === "videoDetection") {
		handleVideoDetection(e.data, port);
	}
}

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

const handleVideoDetection = async (data, port) => {
	const { frame } = data;
	const { data: imageData, timestamp } = frame;
	if (activeFrame) {
		port.postMessage({ type: "detectionResult", result: "skipped", timestamp , imgR: imageData },[imageData.data.buffer]);
		return;
	}
	activeFrame = true;
	const result = await detectImage(imageData);
	activeFrame = false;
	port.postMessage(
		{ type: "detectionResult", result, timestamp, imgR: imageData },
		[imageData.data.buffer]
	);
};

const start = () => {
	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.type === "imageDetection") {
			handleImageDetection(request, sender, sendResponse);
		}
		return true;
	});
};

const detectImage = async (img) => {
	// console.log("img in detectImage", img.width, img.height);
	const tensor = human.tf.browser.fromPixels(img);
	tensor.print();
	console.log("tensors count", human.tf.memory().numTensors);
	// console.log("offscreen tensor", tensor);
	const nsfwResult = await nsfwModelClassify(tensor);
	console.log("offscreen nsfw result", nsfwResult);
	if (containsNsfw(nsfwResult, settings.strictness)) {
		human.tf.dispose(tensor);
		return "nsfw";
	}
	const predictions = await humanModelClassify(tensor);
	console.log("offscreen human result", predictions);
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
