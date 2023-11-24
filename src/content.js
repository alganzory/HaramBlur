import { human, initHuman, initNsfwModel, nsfwModel } from "./modules/detector";
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

if (window.self === window.top) {
	// console.log("HB==I AM THE TOP WINDOW");
	// I am the top window

	getSettings()
		.then(() => {
			// console.log("HB==SETTINGS LOADED");
			emitEvent("settingsLoaded");

			// init human
			return initHuman();
		})
		.then(() => {
			// console.log("HB==HUMAN INITIALIZED");
			// init nsfw model
			return initNsfwModel();
		})
		.then(() => {
			// console.log("HB== models initialized")

			// turn on/off the extension
			toggleOnOffStatus();
		})
		.catch((e) => {
			console.log("HB==INITIALIZATION ERROR", e);
		});
}
