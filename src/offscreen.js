import {
	containsNsfw,
	containsGenderFace,
	Detector,
} from "./modules/detector.js";
import Queue from "./modules/queues.js";
import Settings from "./modules/settings.js";

var settings;
var queue;
let port;
window.onmessage = (e) => {
	if (e.data === new URLSearchParams(location.search).get("secret")) {
		window.onmessage = null;
		port = e.ports[0];
		port.onmessage = onVideoPortMessage;
	}
};

function onVideoPortMessage(e) {
	//   console.log('from content:', e.data);
	if (e.data.type === "videoDetection") {
		handleVideoDetection(e.data, null, (response) => {
			port.postMessage(response);
		});
	} else port.postMessage("ok");
}
var detector = new Detector(); 

const loadModels = async () => {
	try {
		await detector.initHuman();
		await detector.initNsfwModel();
		detector.human.events?.addEventListener("error", (e) => {
			chrome.runtime.sendMessage({ type: "reloadExtension" });			
		});
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
	runDetection(data, true)
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

const startListening = () => {
	settings.listenForChanges();
	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.type === "imageDetection") {
			handleImageDetection(request, sender, sendResponse);
		}
		return true;
	});
};

const runDetection = async (img, isVideo = false) => {
	if (!settings?.shouldDetect() || !img) return false;
	const tensor = detector.human.tf.browser.fromPixels(img);
	// console.log("tensors count", human.tf.memory().numTensors);
	const nsfwResult = await detector.nsfwModelClassify(tensor);
	// console.log("offscreen nsfw result", nsfwResult);
	const strictness = settings.getStrictness() * (isVideo ? 0.75 : 1); // makes detection less strict for videos (to reduce false positives)
	activeFrame = false;
	if (containsNsfw(nsfwResult, strictness)) {
		detector.human.tf.dispose(tensor);
		return "nsfw";
	}
	if (!settings.shouldDetectGender()) return false; // no need to run gender detection if it's not enabled
	const predictions = await detector.humanModelClassify(tensor);
	// console.log("offscreen human result", predictions);
	detector.human.tf.dispose(tensor);
	if (containsGenderFace(predictions, settings.shouldDetectMale(), settings.shouldDetectFemale()))
		return "face";
	return false;
};

const init = async () => {
	let _settings = await browser.storage.sync.get(["hb-settings"]);
	while (_settings?.["hb-settings"] === undefined) {
		_settings = await browser.storage.sync.get(["hb-settings"]);
	}
	settings = await Settings.init(_settings["hb-settings"]);
	console.log("Settings loaded", settings);
	try{
		await loadModels();
		console.log("Models loaded", detector.human, detector.nsfwModel);
	} catch (error) {
		console.log("Error loading models", error);
		chrome.runtime.sendMessage({ type: "reloadExtension" });
		return;
	}
	
	queue = new Queue(runDetection);
	startListening();
};

init();
