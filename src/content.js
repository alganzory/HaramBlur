import Human from "@vladmandic/human";
import plimit from "p-limit";

const modelsUrl = chrome.runtime.getURL("src/assets/models");
const limit = plimit(5);

const config = {
	modelBasePath: modelsUrl,
	face: {
		enabled: true,
		modelPath: "blazeface.json",
		iris: { enabled: false },
		// description: { enabled: false },
	},

	// disable all other models
	// except face
	// to save resources
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

var human; // global variable to hold human object
var intersectionObserver, mutationObserver;

const initHuman = async () => {
	human = new Human(config);
};

const initIntersectionObserver = async () => {
	intersectionObserver = new IntersectionObserver(
		(entries) => {
			const promises = entries.map((entry) =>
				limit(async () => {
					if (entry.isIntersecting) {
						const img = entry.target;
						intersectionObserver.unobserve(img);
						return detectFace(img);
					}
				})
			);
			Promise.allSettled(promises);
		}
		// { threshold: 0.5 }
	);
};

const initMutationObserver = async () => {
	mutationObserver = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === "childList") {
				const addedNodes = mutation.addedNodes;

				addedNodes.forEach((node) => {
					// if node has no children, return
					if (!node?.querySelectorAll) return;

					const imgs = node?.querySelectorAll("img");
					Array.from(imgs).forEach((img) => {
						observeImage(img);
					});
				});
			}
		});
	});
};

const isImageTooSmall = (img) => {
	return img.width < 100 || img.height < 100;
};

const observeImage = (img) => {
	if (isImageTooSmall(img)) return;

	intersectionObserver.observe(img);
};

const loadImage = (img) => {
	return new Promise((resolve, reject) => {
		if (img.complete) {
			resolve(img);
		} else {
			img.onload = () => resolve(img);
			img.onerror = (e) => {
				console.error("Failed to load image", img);
				reject(e);
			};
		}
	});
};

const processImage = async (img) => {
	if (isImageTooSmall(img)) return;

	// check if image is loaded, print error if not
	const loadedImage = await loadImage(img);

	let detections = await human.detect(loadedImage);
	// console.log("detections", detections);
	// return;

	if (!detections?.face?.length) {
		console.log("skipping cause no faces", img);

		return;
	}

	detections = detections.face;

	let containsWoman = false;
	detections.forEach((detection) => {
		if (detection.gender === "female") {
			containsWoman = true;
		}
	});

	if (!containsWoman) {
		console.log("skipping cause not a woman", img);
		return;
	}

	img.style.filter = "blur(10px) grayscale(100%)";
	img.style.transition = "all 0.5s ease";
};

const detectFace = async (img) => {
	img.crossOrigin = "anonymous";

	await processImage(img);
	img.onerror = () => {
		console.error("Failed to load image", img);
	};
};

const init = async () => {

	console.log ("INIT");
	await initHuman();
	await initIntersectionObserver();
	await initMutationObserver();

	// wait for human to load
	await human.load();
	await human.warmup();
	
	
	// observe all images on the page
	const images = document.getElementsByTagName("img");

	Array.from(images).forEach((img) => {
		observeImage(img);
	});

	mutationObserver.observe(document.body, { childList: true, subtree: true });
};

init().catch((error) => {
	console.error("Error initializing:", error);
});
