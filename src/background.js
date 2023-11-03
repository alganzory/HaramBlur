// when installed or updated load settings

const defaultSettings = {
	status: true,
	blurryStartMode: true,
	blurAmount: 15,
	blurImages: true,
	blurVideos: true,
	blurMale: false,
	blurFemale: true,
	unblurImages: true,
	unblurVideos: false,
	strictness: 0.3, // goes from 0 to 1
};

chrome.runtime.onInstalled.addListener(function () {
	chrome.storage.sync.get(["hb-settings"], function (result) {
		if (
			result["hb-settings"] === undefined ||
			result["hb-settings"] === null
		) {
			chrome.storage.sync.set({ "hb-settings": defaultSettings });
		} else {
			// if there are any new settings, add them to the settings object
			chrome.storage.sync.set({
				"hb-settings": { ...defaultSettings, ...result["hb-settings"] },
			});
		}
	});
});
