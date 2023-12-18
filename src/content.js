import {
	attachObserversListener,
	initMutationObserver,
} from "./modules/observers";
import Settings from "./modules/settings";
import { attachStyleListener } from "./modules/style";

const attachAllListeners = () => {
	// Listen for more settings
	attachStyleListener();
	attachObserversListener();
};

if (window.self === window.top) {
	attachAllListeners();
	initMutationObserver();

	Settings.init()
		.then((settings) => {
			// turn on/off the extension
			settings.toggleOnOffStatus();
		})
		.catch((e) => {
			console.log("HB==INITIALIZATION ERROR", e);
		});
}