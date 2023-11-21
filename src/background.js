// when installed or updated load settings

const defaultSettings = {
	status: true,
	blurryStartMode: false,
	blurAmount: 20,
	blurImages: true,
	blurVideos: true,
	blurMale: false,
	blurFemale: true,
	unblurImages: false,
	unblurVideos: false,
	strictness: 0.5, // goes from 0 to 1
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

// on uninstall
chrome.runtime.setUninstallURL(
	"https://forms.gle/RovVrtp29vK3Z7To7"
);