// detector.js
// This module exports the human variable and the HUMAN_CONFIG object

import Human from "@vladmandic/human";
const modelsUrl = chrome.runtime.getURL("src/assets/models/human");
const nfswUrl = chrome.runtime.getURL("src/assets/models/nsfwjs/model.json");
/**
 * @type {import("@vladmandic/human").Config}
 */
const HUMAN_CONFIG = {
	modelBasePath: modelsUrl,
	backend: "humangl",
	debug: false,
	cacheSensitivity: 0,
	warmup: "none",
	// filter: {
	// 	width: 224,
	// 	height: 224,
	// },
	face: {
		enabled: true,
		iris: { enabled: false },
		mesh: { enabled: false },
		emotion: { enabled: false },
		detector: {
			modelPath: "blazeface.json",
			maxDetected: 2,
		},
		description: {
			enabled: true,
			modelPath: "faceres.json",
		},
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

let human;
let nsfwModel;

const initHuman = () => {
	human = new Human(HUMAN_CONFIG);
	return human.load();
};

const NSFW_CLASSES = {
	0: {
		className: "Drawing",
		nsfw: false,
		thresh: 0.5,
	},
	1: {
		className: "Hentai",
		nsfw: true,
		thresh: 0.1,
	},
	2: {
		className: "Neutral",
		nsfw: false,
		thresh: 0.8,
	},
	3: {
		className: "Porn",
		nsfw: true,
		thresh: 0.05,
	},
	4: {
		className: "Sexy",
		nsfw: true,
		thresh: 0.05,
	},
};

const initNsfwModel = async () => {
	// load the model from indexedDB if it exists, otherwise load from url
	const indexedDBModel =
		typeof indexedDB !== "undefined" && (await human.tf.io.listModels());

	// if the model exists in indexedDB, load it from there
	if (indexedDBModel?.["indexeddb://nsfw-model"]) {
		nsfwModel = await human.tf.loadGraphModel("indexeddb://nsfw-model");
	}
	// otherwise load it from the url
	else {
		nsfwModel = await human.tf.loadGraphModel(nfswUrl);
		// save the model to indexedDB
		await nsfwModel.save("indexeddb://nsfw-model");
	}
	// console.log("HB==NSFW MODEL", nsfwModel);
};


const nsfwModelClassify = async (tensor, tf) => {
	const resized = tf.image.resizeBilinear(tensor, [224, 224]);
	const normalized = tf.div(resized, tf.scalar(255));
	const logits = await nsfwModel.predict(normalized);

	const predictions = await getTopKClasses(logits, 3);
	tf.dispose([resized, normalized, logits]);

	return predictions;
};

async function getTopKClasses(logits, topK) {
	const values = await logits.data();

	const valuesAndIndices = [];
	for (let i = 0; i < values.length; i++) {
		valuesAndIndices.push({ value: values[i], index: i });
	}
	valuesAndIndices.sort((a, b) => {
		return b.value - a.value;
	});
	const topkValues = new Float32Array(topK);
	const topkIndices = new Int32Array(topK);
	for (let i = 0; i < topK; i++) {
		topkValues[i] = valuesAndIndices[i].value;
		topkIndices[i] = valuesAndIndices[i].index;
	}

	const topClassesAndProbs = [];
	for (let i = 0; i < topkIndices.length; i++) {
		topClassesAndProbs.push({
			className: NSFW_CLASSES[topkIndices[i]].className,
			probability: topkValues[i],
			id: topkIndices[i],
		});
	}
	return topClassesAndProbs;
}
// export the human variable and the HUMAN_CONFIG object
export {
	initHuman,
	initNsfwModel,
	nsfwModel,
	human,
	HUMAN_CONFIG,
	nsfwModelClassify,
	NSFW_CLASSES,
};
