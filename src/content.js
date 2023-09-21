import * as faceapi from "face-api.js";
try {
	const modelsUrl = chrome.runtime.getURL("src/assets/models");
	console.log("modelsUrl", modelsUrl);
	// Load the models
	await faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl);
	// await faceapi.nets.faceLandmark68Net.loadFromUri(modelsUrl);
	await faceapi.nets.ageGenderNet.loadFromUri(modelsUrl);

	console.log("Models loaded successfully");
} catch (error) {
	console.error("Error loading models:", error);
}
// Get all images on the page
const images = document.getElementsByTagName("img");

let imageMap = new Map();
let imageArr = Array.from(images);

// filter out images that are too small to be seen
imageArr = imageArr.filter((img) => {
	return img.width > 100 && img.height > 100;
});

imageArr.forEach((img, i) => {
	imageMap.set(img.src, img);
	if (i === imageArr.length - 1) {
		img.style.border = "30px solid red";
	}
});

console.log("imageMap", imageMap);

try {
	// Fetch all images as Blobs
	const fetchPromises = Array.from(imageMap.keys()).map(async (key) => {
		const response = await fetch(key);
		if (!response.ok) {
			throw new Error(`Failed to fetch image ${key}`);
		}
		const blob = await response.blob();
		return { key, blob };
	});
	const fetchResults = await Promise.allSettled(fetchPromises);

	// Create an object URL for each Blob and store it in the imageMap
	fetchResults.forEach((result) => {
		if (result.status === "fulfilled") {
			const { key, blob } = result.value;
			const objectUrl = URL.createObjectURL(blob);
			const img = imageMap.get(key);
			img.src = objectUrl;
			imageMap.set(key, img);
		} else {
			console.error(result.reason);
			const key = result.reason.message.split(" ")[3];
			imageMap.delete(key);
		}
	});

	// console.log("imageMap", imageMap);

	// Detect faces in the images and apply a blur to the ones that contain women
	for (const [key, value] of imageMap.entries()) {
		const img = value;
		
		const faceApiImage = new Image();
		faceApiImage.src = img.src;

		// Detect faces in the image
		const detections = await faceapi
			.detectAllFaces(faceApiImage, new faceapi.TinyFaceDetectorOptions())
			.withAgeAndGender();

		console.log("detections", detections)

		// if no faces are detected, skip this image and delete it from the map
		if (detections.length === 0) {
			// console.log(`Skipping image ${key} because no faces were detected`);
			imageMap.delete(key);
			continue;
		}
		

		// if detections don't contain a woman, skip this image and delete it from the map
		let containsWoman = false;
		detections.forEach((detection) => {
			if (detection.gender === "female") {
				containsWoman = true;
			}
		});

		if (!containsWoman) {
			console.log(
				// `Skipping image ${key} because it doesn't contain a woman`
			);
			imageMap.delete(key);
			continue;
		}

		value.style.filter = "blur(10px) grayscale(100%)";
	}
} catch (error) {
	console.error("Error detecting faces:", error);
}
