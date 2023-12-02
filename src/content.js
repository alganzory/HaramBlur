import {
	attachObserversListener,
	initMutationObserver,
} from "./modules/observers";
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

if (window.self === window.top) {
	attachAllListeners();
	initMutationObserver();

	getSettings()
		.then(() => {
			// turn on/off the extension
			toggleOnOffStatus();
		})
		.catch((e) => {
			console.log("HB==INITIALIZATION ERROR", e);
		});
}