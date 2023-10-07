// when installed or updated load settings

const defaultSettings = {
	status: true,
	blurAmount: 15,
	blurImages: true,
	blurVideos: true,
	blurMale: false,
	blurFemale: true,
	unblurImages: true,
	unblurVideos: false,
};

chrome.runtime.onInstalled.addListener(function () {
	chrome.storage.sync.get(["hb-settings"], function (result) {
		if (
			result["hb-settings"] === undefined ||
			result["hb-settings"] === null
		) {
			chrome.storage.sync.set({ "hb-settings": defaultSettings });
		}
	});
});
