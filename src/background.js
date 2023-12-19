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
	gray: true,
	strictness: 0.5, // goes from 0 to 1
};

const initSettings = async () => {
	let result = await browser.storage.sync.get(["hb-settings"]);
	if (
		result?.["hb-settings"] === undefined ||
		result?.["hb-settings"] === null ||
		Object.keys(result?.["hb-settings"]).length === 0
	) {
		await browser.storage.sync.set({ "hb-settings": defaultSettings });
	} else {
		// if there are any new settings, add them to the settings object
		await browser.storage.sync.set({
			"hb-settings": { ...defaultSettings, ...result["hb-settings"] },
		});
	}
	result = await browser.storage.sync.get(["hb-settings"]);
	return result;
};
chrome.runtime.onInstalled.addListener(async function () {
	try {
		await initSettings();
	} catch (error) {
		console.error(error);
	}
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === "getSettings") {
		initSettings().then((result) => {
			const isVideoEnabled =
				result["hb-settings"]?.status &&
				result["hb-settings"]?.blurVideos;
			chrome.contextMenus.update("enable-detection", {
				enabled: isVideoEnabled,
				checked: isVideoEnabled,
				title: isVideoEnabled
					? "HaramBlur: Enabled for this video"
					: "HaramBlur: Please enable video detection in settings",
			});

			sendResponse(result["hb-settings"]);
		});

		return true;
	} else if (request.type === "video-status") {
		chrome.contextMenus.update("enable-detection", {
			checked: request.status,
		});
	}
});

// context menu: "enable detection on this video"
chrome.contextMenus.create({
	id: "enable-detection",
	title: "HaramBlur: Enable for this video",
	contexts: ["all"],
	type: "checkbox",
	enabled: true,
	checked: true,
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	console.log("HB== context menu clicked", info, tab);
	if (info.menuItemId === "enable-detection") {
		if (info.checked) {
			chrome.tabs.sendMessage(tab.id, {
				type: "enable-detection",
			});
		} else {
			chrome.tabs.sendMessage(tab.id, {
				type: "disable-detection",
			});
		}
	}

	return true;
});

// on install, onboarding
chrome.runtime.onInstalled.addListener(function (details) {
	if (details.reason !== "install") {
		return;
	}
	chrome.tabs.create({
		url: "https://onboard.haramblur.com/",
	});
});

// on uninstall
chrome.runtime.setUninstallURL("https://forms.gle/RovVrtp29vK3Z7To7");
