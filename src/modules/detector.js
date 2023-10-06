// detector.js
// This module exports the human variable and the HUMAN_CONFIG object

import Human from "@vladmandic/human";

const modelsUrl = chrome.runtime.getURL("src/assets/models");

/**
 * @type {import("@vladmandic/human").Config}
 */
const HUMAN_CONFIG = {
	modelBasePath: modelsUrl,
	debug: false,
	cacheSensitivity: 0,
	warmup: "none",
	face: {
		enabled: true,
		// async: true,
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: { modelPath: "blazeface-front.json", maxDetected: 2 },
		// description: {enabled: false},
		description: {
			enabled: true,
			modelPath: "faceres.json",
		},
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


let human = new Human(HUMAN_CONFIG);

const initHuman = async () => {
	await human.load();
};


// export the human variable and the HUMAN_CONFIG object
export { initHuman, human, HUMAN_CONFIG };
