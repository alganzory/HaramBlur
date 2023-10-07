import { human, initHuman } from "./modules/detector";
import { attachObserversListener } from "./modules/observers";
import {
	getSettings,
	listenForMessages,
	toggleOnOffStatus,
} from "./modules/settings";
import { attachStyleListener } from "./modules/style";

Promise.all([initHuman(), getSettings()])
	.then(() => {
		// console.log("HB==HUMAN LOADED", "HB==SETTINGS LOADED", human);

		// wait for the dom to load
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => {
				// console.log("HB==DOM LOADED");
				// turn on/off the extension
				attachAllListeners();
				toggleOnOffStatus();
			});
		} else {
			// console.log("HB==DOM ALREADY LOADED", document.readyState);
			attachAllListeners();

			// turn on/off the extension
			toggleOnOffStatus();
		}
	})
	.catch((err) => {
		console.error("HB==ERROR", err);
	});

const attachAllListeners = () => {
	attachStyleListener();
	attachObserversListener();
	// Listen for more settings
	listenForMessages();
};
