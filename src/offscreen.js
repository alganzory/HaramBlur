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
// let frameImage = new Image();

const handleVideoDetection = async (request, sender, sendResponse) => {
	const { frame } = request;
	const { data, timestamp } = frame;
	if (activeFrame) {
		sendResponse({ result: "skipped" });
		return;
	}
	activeFrame = true;
	// frameImage.onload = () => {
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
	// };
	// frameImage.onerror = (e) => {
	// 	console.log("HB== image error", e);
	// 	activeFrame = false;
	// 	sendResponse({ result: "error" });
	// };
	// frameImage.src = data;
};

const startListening = () => {
	settings.listenForChanges();
	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.type === "imageDetection") {
			handleImageDetection(request, sender, sendResponse);
		}
		// if (request.type === "videoDetection") {
		// 	handleVideoDetection(request, sender, sendResponse);
		// }
		return true;
	});
};

const runDetection = async (img, isVideo = false) => {
	if (!settings?.shouldDetect() || !img) return false;
	const tensor = human.tf.browser.fromPixels(img);
	// console.log("tensors count", human.tf.memory().numTensors);
	const nsfwResult = await nsfwModelClassify(tensor);
	// console.log("offscreen nsfw result", nsfwResult);
	const strictness = settings.getStrictness() * (isVideo ? 0.75 : 1); // makes detection less strict for videos (to reduce false positives)
	if (containsNsfw(nsfwResult, strictness)) {
		human.tf.dispose(tensor);
		return "nsfw";
	}
	const predictions = await humanModelClassify(tensor);
	// console.log("offscreen human result", predictions);
	human.tf.dispose(tensor);
	if (
		containsGenderFace(
			predictions,
			settings.shouldDetectMale(),
			settings.shouldDetectFemale()
		)
	)
		return "face";
	return false;
};

const init = async () => {
	const _settings = await browser.storage.sync.get(["hb-settings"]);
	settings = await Settings.init(_settings["hb-settings"]);
	console.log("Settings loaded", settings);
	await loadModels();
	console.log("Models loaded", human, nsfwModel);
	queue = new Queue(runDetection);
	startListening();
};

init();
