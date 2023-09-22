import Human from "@vladmandic/human";
const modelsUrl = chrome.runtime.getURL("src/assets/models");
const human = new Human({
	modelBasePath: modelsUrl,
	face: {
		enabled: true,
		mesh: { enabled: false },
		// modelPath: "mobileface.json",
		iris: { enabled: false },
		description: { 
			modelPath: "faceres.json"
		 },
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
});

var counter = 0;
const observer = new IntersectionObserver(
	(entries) => {
		const promises = entries.map(async (entry) => {
			if (entry.isIntersecting) {
				const img = entry.target;
				observer.unobserve(img);
				return detectFace(img);
			}
		});
		Promise.allSettled(promises);
	}
	// { threshold: 0.5 }
);

// let faceApiImage = new Image();
// faceApiImage.crossOrigin = "anonymous";

const isImageTooSmall = (img) => {
	return img.width < 100 || img.height < 100;
};

const observeImage = (img) => {
	if (isImageTooSmall(img)) return;

	observer.observe(img);
};

const processImage = async (img) => {
	if (isImageTooSmall(img)) return;

	let detections = await human.detect(img);
	console.log("detections", detections);
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

	// print counter and current scroll position
	print (counter++, window.scrollY);
	img.style.filter = "blur(10px) grayscale(100%)";
	img.style.transition = "all 0.5s ease";
};

const detectFace = async (img) => {
	img.crossOrigin = "anonymous";

	img.onload = processImage(img);
	img.onerror = () => {
		console.error("Failed to load image", img);
	};
};

const init = async () => {
	// wait for human to load
	await human.load();

	// observe all images on the page

	const images = document.getElementsByTagName("img");

	Array.from(images).forEach((img) => {
		observeImage(img);
	});
	const mutationObserver = new MutationObserver((mutations) => {
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

	mutationObserver.observe(document.body, { childList: true, subtree: true });
};

init().catch((error) => {
	console.error("Error initializing:", error);
});
