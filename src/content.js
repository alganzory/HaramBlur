// import { human, initHuman, initNsfwModel, nsfwModel } from "./modules/detector";
import { emitEvent } from "./modules/helpers";
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
			// console.log("HB== models initialized")

			// turn on/off the extension
			toggleOnOffStatus();
			return makeVideoFramePort("/src/offscreen.html");
		})
		.then((port) => {
			port.onmessage = (event) => {
				console.log("Got message from extension frame:", event.data);
			};
			port.postMessage("Hello from content script");
			emitEvent("videoFramePort", port)
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
