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
	strictness: 0.5, // goes from 0 to 1,
	whitelist: [],
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


const createOffscreenDoc = () => {
	chrome?.offscreen
	.createDocument({
		url: chrome.runtime.getURL("src/offscreen.html"),
		reasons: ["DOM_PARSER"],
		justification: "Process Images",
	})
	.then((document) => {
		console.log("offscreen document created");
	})
	.finally(() => {});
}

createOffscreenDoc();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === "getSettings") {
		chrome.storage.sync.get(["hb-settings"], function (result) {
			sendResponse(result["hb-settings"]);

			const isVideoEnabled =
				result["hb-settings"].status &&
				result["hb-settings"].blurVideos;
			chrome.contextMenus.update("enable-detection", {
				enabled: isVideoEnabled,
				checked: isVideoEnabled,
				title: isVideoEnabled
					? "Enabled for this video"
					: "Please enable video detection in settings",
			});
		});
		return true;
	} else if (request.type === "video-status") {
		chrome.contextMenus.update("enable-detection", {
			checked: request.status,
		});
		return true;
	}
	else if (request.type === "reloadExtension") {
		// kill the offscreen document
		chrome?.offscreen?.closeDocument();
		// recreate the offscreen document
		createOffscreenDoc();
	}
});

// context menu: "enable detection on this video"
chrome.contextMenus.create({
	id: "enable-detection",
	title: "Enable for this video",
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
	if (details?.reason === "install") {
		chrome.tabs.create({
			url: "https://onboard.haramblur.com/",
		});
	} else if (details?.reason === "update") {
		const currentVersion = chrome.runtime.getManifest().version;
		if (currentVersion == "0.2.4" || currentVersion == "0.2.5") return; // no need to show update page for this version
		const previousVersion = details.previousVersion;
		if (currentVersion != previousVersion) {
			chrome.tabs.create({
				url: "https://update.haramblur.com/",
			});
		}
	}
});

// on uninstall
chrome.runtime.setUninstallURL("https://forms.gle/RovVrtp29vK3Z7To7");
