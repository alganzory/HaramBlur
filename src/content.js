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
	makeVideoFramePort('/src/offscreen.html').then((port) => {
		initMutationObserver(port);
	});

	Settings.init()
		.then((settings) => {
			// turn on/off the extension
			settings.toggleOnOffStatus();
		})
		.catch((e) => {
			console.log("HB==INITIALIZATION ERROR", e);
		});
}


async function makeVideoFramePort(path) {
	const secret = Math.random().toString(36);
	const url = new URL(chrome.runtime.getURL(path));
	url.searchParams.set("secret", secret);
	const el = document.createElement("div");
	const root = el.attachShadow({ mode: "closed" });
	const iframe = document.createElement("iframe");
	iframe.hidden = true;
	root.appendChild(iframe);
	(document.body || document.documentElement).appendChild(el);
	await new Promise((resolve, reject) => {
		iframe.onload = resolve;
		iframe.onerror = reject;
		iframe.contentWindow.location.href = url;
	});
	const mc = new MessageChannel();
	iframe.contentWindow.postMessage(secret, "*", [mc.port2]);
	return mc.port1;
}
