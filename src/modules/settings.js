import { emitEvent, listenToEvent } from "./helpers";

let settings = {};

let shouldDetectVideos = true;
let shouldDetectImages = true;
let shouldDetectMale = false;
let shouldDetectFemale = false;

function shouldDetectGender() {
	return shouldDetectMale || shouldDetectFemale;
}
function shouldDetect() {
	if (!shouldDetectImages && !shouldDetectVideos) return false;
	return shouldDetectGender();
}

function isBlurryStartMode() {
	return settings.blurryStartMode;
}

function setSettings() {
	if (settings.status !== true) {
		shouldDetectImages = false;
		shouldDetectVideos = false;
	} else {
		shouldDetectImages = settings.blurImages;
		shouldDetectVideos = settings.blurVideos;
		shouldDetectMale = settings.blurMale;
		shouldDetectFemale = settings.blurFemale;
	}
}

function toggleOnOffStatus() {
	// console.log("HB==toggleOnOffStatus", settings.status)

	setSettings();
	// console.log("HB==toggleOnOffStatus", settings.status);
	emitEvent("toggleOnOffStatus", settings.status);
}

function getSettings() {
	return new Promise(function (resolve) {
		chrome.storage.sync.get(["hb-settings"], function (storage) {
			settings = storage["hb-settings"];
			resolve();
		});
	});
}

function listenForMessages() {
	listenToEvent("settingsLoaded", setSettings)
	chrome.runtime.onMessage.addListener(function (
		request,
		sender,
		sendResponse
	) {
		if (request.message?.type === "updateSettings") {
			updateSettings(request.message.newSetting);
		}
	});
}

const updateSettings = (newSetting) => {
	// console.log("HB==updateSettings", newSetting);
	const { key, value } = newSetting;

	// take action based on key
	switch (key) {
		case "status":
			settings.status = value;
			toggleOnOffStatus();
			break;
		case "blurAmount":
			settings.blurAmount = value;
			changeBlurAmount();
			break;
	}
};

const changeBlurAmount = () => {
	// emit event to style.js
	emitEvent("changeBlurAmount", settings.blurAmount);
};

export { settings, isBlurryStartMode, getSettings, toggleOnOffStatus, listenForMessages, shouldDetect, shouldDetectGender, shouldDetectImages, shouldDetectVideos, shouldDetectMale, shouldDetectFemale};
