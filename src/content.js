import {
    attachObserversListener,
    initMutationObserver,
    killObserver,
} from "./modules/observers";
import Settings from "./modules/settings";
import { attachStyleListener } from "./modules/style";

const isTopLevel = window.self === window.top;

const getTopLevelHostname = () => {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "getTopHostname", hostname: window.location.hostname },
            (response) => {
                resolve(response?.hostname || window.location.hostname);
            }
        );
    });
};

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

const checkWhitelistAndStart = async (settings) => {
    const hostname = isTopLevel
        ? window.location.hostname
        : await getTopLevelHostname();
    const normalized = hostname?.split("www.")?.[1] ?? hostname;

    if (settings.getWhitelist().includes(normalized)) {
        console.log("HB==WHITELISTED SITE", normalized);
        killObserver();
        return;
    }

    settings.toggleOnOffStatus();
};

attachAllListeners();
initMutationObserver();
Settings.init()
    .then((settings) => checkWhitelistAndStart(settings))
    .catch((e) => {
        console.log("HB==INITIALIZATION ERROR", e);
    });
