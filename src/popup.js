var settings = {};

initPopup();

const refreshableSettings = [
	"blurImages",
	"blurVideos",
	"blurMale",
	"blurFemale",
	"unblurImages",
	"unblurVideos",
];

const allSettings = ["status", "blurAmount", ...refreshableSettings];

var refreshMessage, container;

function initPopup() {
	console.log("initPopup");
	loadLocalSettings().then(function () {
		if (document.readyState === "complete" || "interactive") {
			displaySettings(settings);
			addListeners();
		} else {
			document.addEventListener("DOMContentLoaded", function () {
				displaySettings(settings);
				addListeners();
			});
		}
	});
}

function loadLocalSettings() {
	return new Promise(function (resolve) {
		chrome.storage.sync.get(["hb-settings"], function (storage) {
			console.log("🚀 ~ file: popup.js:26 ~ storage:", storage);
			settings = storage["hb-settings"];
			resolve();
		});
	});
}

function toggleAllInputs() {
	if (container) {
		container.style.opacity = settings.status ? 1 : 0.5;
	}
	allSettings.forEach(function (setting) {
		if (setting !== "status") {
			document.querySelector("input[name=" + setting + "]").disabled =
				!settings.status;
		}
	});
}

function displaySettings(settings) {
	document.querySelector("input[name=status]").checked = settings.status;
	document.querySelector("input[name=blurAmount]").value =
		settings.blurAmount;
	document.querySelector("span[id=blur-amount-value]").innerHTML =
		settings.blurAmount + "px";
	document.querySelector("input[name=blurImages]").checked =
		settings.blurImages;
	document.querySelector("input[name=blurVideos]").checked =
		settings.blurVideos;
	document.querySelector("input[name=blurMale]").checked = settings.blurMale;
	document.querySelector("input[name=blurFemale]").checked =
		settings.blurFemale;
	document.querySelector("input[name=unblurImages]").checked =
		settings.unblurImages;
	document.querySelector("input[name=unblurVideos]").checked =
		settings.unblurVideos;

	toggleAllInputs();
}

/* addListeners - (1) Listen for changes to popup modal inputs (2) route to appropriate function  */
function addListeners() {
	document
		.querySelector("input[name=status]")
		.addEventListener("change", updateStatus);
	document
		.querySelector("input[name=blurImages]")
		.addEventListener("change", updateCheckbox("blurImages"));
	document
		.querySelector("input[name=blurVideos]")
		.addEventListener("change", updateCheckbox("blurVideos"));
	document
		.querySelector("input[name=blurMale]")
		.addEventListener("change", updateCheckbox("blurMale"));
	document
		.querySelector("input[name=blurFemale]")
		.addEventListener("change", updateCheckbox("blurFemale"));
	document
		.querySelector("input[name=blurAmount]")
		.addEventListener("change", updateBlurAmount);
	document
		.querySelector("input[name=unblurImages]")
		.addEventListener("change", updateCheckbox("unblurImages"));
	document
		.querySelector("input[name=unblurVideos]")
		.addEventListener("change", updateCheckbox("unblurVideos"));

	refreshMessage = document.querySelector("#refresh-message");
	container = document.querySelector("#container");
}

function updateStatus() {
	settings.status = document.querySelector("input[name=status]").checked;
	chrome.storage.sync.set({ "hb-settings": settings });
	toggleAllInputs();
	sendUpdatedSettings("status");
}

function updateBlurAmount() {
	settings.blurAmount = document.querySelector(
		"input[name=blurAmount]"
	).value;
	document.querySelector("span[id=blur-amount-value]").innerHTML =
		settings.blurAmount + "px";
	chrome.storage.sync.set({ "hb-settings": settings });
	sendUpdatedSettings("blurAmount");
}

function updateCheckbox(key) {
	return function () {
		settings[key] = document.querySelector(
			"input[name=" + key + "]"
		).checked;
		chrome.storage.sync.set({ "hb-settings": settings });
		sendUpdatedSettings(key);
	};
}

/* sendUpdatedSettings - Send updated settings object to tab.js to modify active tab blur CSS */
function sendUpdatedSettings(key) {
	chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
		var activeTab = tabs[0];
		chrome.tabs.sendMessage(activeTab.id, {
			message: {
				type: "updateSettings",
				newSetting: {
					key: key,
					value: settings[key],
				},
			},
		});

		if (refreshableSettings.includes(key)) {
			refreshMessage.classList.remove("hidden");
		}
	});
}
