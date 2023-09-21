import * as faceapi from "face-api.js";

const modelsUrl = chrome.runtime.getURL("src/assets/models");

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

	const detections = await faceapi
		.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions(
			{
				
			}
		))
		.withAgeAndGender();

	if (detections.length === 0) {
		console.log ("skipping cause no faces", img)

		return;
	}

	let containsWoman = false;
	detections.forEach((detection) => {
		if (detection.gender === "female") {
			containsWoman = true;
		}
	});

	if (!containsWoman) {
		console.log ("skipping cause not a woman", img)
		return;
	}

	img.style.filter = "blur(10px) grayscale(100%)";
	img.style.transition = "all 0.5s ease";
};

const detectFace = async (img) => {
	img.crossOrigin = "anonymous";

	img.onload = processImage( img);
	img.onerror = () => {
		console.error("Failed to load image", img);
	};
};

const init = async () => {
	const [tinyFaceDetector, ageGenderNet] = await Promise.all([
		faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl),
		faceapi.nets.ageGenderNet.loadFromUri(modelsUrl),
	]);

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
