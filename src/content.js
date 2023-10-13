import { human, initHuman } from "./modules/detector";
import { emitEvent } from "./modules/helpers";
import { attachObserversListener } from "./modules/observers";
import {
	getSettings,
	listenForMessages,
	toggleOnOffStatus,
} from "./modules/settings";
import { attachStyleListener } from "./modules/style";

const attachAllListeners = () => {
	// Listen for more settings
	listenForMessages();
	attachStyleListener();
	attachObserversListener();
};

attachAllListeners();
getSettings()
	.then(() => {
		// console.log("HB==SETTINGS LOADED");
		emitEvent("settingsLoaded");

		// init human
		return initHuman();
	})
	.then(() => {
		// console.log("HB==HUMAN INITIALIZED", human);

		// wait for the dom to load
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => {
				// console.log("HB==DOM LOADED");
				// turn on/off the extension
				toggleOnOffStatus();
			});
		} else {
			// console.log("HB==DOM ALREADY LOADED", document.readyState);

			// turn on/off the extension
			toggleOnOffStatus();
		}
	})
	.catch((e) => {
		console.log("HB==INITIALIZATION ERROR", e);
	});
