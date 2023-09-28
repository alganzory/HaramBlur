import Human from "@vladmandic/human";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const config = {
	modelBasePath: modelsUrl,
	debug: false,
	warmup: "face",
	face: {
		enabled: true,
		// async: true,
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: { modelPath: "blazeface-front.json", maxDetected: 2 },
		// description: {enabled: false},
		description: { enabled: true, modelPath: "faceres.json" },
		// gear: { enabled: true, modelPath: "gear.json" },
	},
	body: {
		enabled: false,
	},
	hand: {
		enabled: false,
	},
	gesture: {
		enabled: false,
	},
	object: {
		enabled: false,
	},
};

const human = new Human(config);
// console.log("background.js loaded", human);

human
	.load()
	.then(() => {
		console.log("background.js loaded human");
	})
	.catch((err) => {
		console.error("background.js failed to load human", err);
	});

// port for communication with content2.js
chrome.runtime.onConnect.addListener((port) => {
	console.log("background.js received connection from content.js");
	if (port.name !== "content") return;
	port.onMessage.addListener(async (msg) => {
		console.log("background.js received message", msg);
		const img = new ImageData(
			new Uint8ClampedArray(msg.img),
			msg.width,
			msg.height
		);
		const result = msg.config
			? await human.detect(img, msg.config)
			: await human.detect(img);
		const message = {
			type: "detections",
			imgSrc: msg.imgSrc,
			detections: result,
		};
		port.postMessage(message);
	});
});
