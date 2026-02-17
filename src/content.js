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

    // Initialize settings first, observer only after whitelist check
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

            // Only init observer after whitelist check passes
            initMutationObserver();

            // turn on/off the extension
            settings.toggleOnOffStatus();
        })
        .catch((e) => {
            console.log("HB==INITIALIZATION ERROR", e);
        });
}
