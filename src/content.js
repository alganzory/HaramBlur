import {
    attachObserversListener,
    initMutationObserver,
    killObserver,
} from "./modules/observers";
import Settings from "./modules/settings";
import { attachStyleListener } from "./modules/style";

const attachAllListeners = () => {
    // Listen for more settings
    attachStyleListener();
    attachObserversListener();

    // listen for getCurrentWebsite from popup.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "getCurrentWebsite") {
            sendResponse({ currentWebsite: window.location.hostname });
        }
    });
};

if (window.self === window.top) {
    attachAllListeners();
    initMutationObserver();
    Settings.init()
        .then((settings) => {
            if (
                settings
                    .getWhitelist()
                    .includes(
                        window.location.hostname?.split("www.")?.[1] ??
                            window.location.hostname
                    )
            ) {
                console.log("HB==WHITELISTED SITE");
                killObserver();
                return;
            }

            // turn on/off the extension
            settings.toggleOnOffStatus();
        })
        .catch((e) => {
            console.log("HB==INITIALIZATION ERROR", e);
        });
}
