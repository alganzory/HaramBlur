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
};

chrome.runtime.onInstalled.addListener(async function () {
	try {
		const result = await browser.storage.sync.get(["hb-settings"]);
		if (
			result?.["hb-settings"] === undefined ||
			result?.["hb-settings"] === null
		) {
			await browser.storage.sync.set({ "hb-settings": defaultSettings });
		} else {
			// if there are any new settings, add them to the settings object
			await browser.storage.sync.set({
				"hb-settings": { ...defaultSettings, ...result["hb-settings"] },
			});
		}
	} catch (error) {
		console.error(error);
	}
});
