// observers.js
// This module exports mutation observer and image processing logic.
import {
    disableVideo,
    enableVideo,
    isImageTooSmall,
    listenToEvent,
    processNode,
    updateBGvideoStatus,
} from "./helpers.js";

import { applyBlurryStart } from "./style.js";
import { processImage, processVideo } from "./processing2.js";
import { STATUSES } from "../constants.js";
let mutationObserver, _settings;
let videosInProcess = [];

const startObserving = () => {
    if (!mutationObserver) initMutationObserver();

    mutationObserver?.observe(document, {
        childList: true,
        characterData: false,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
    });
};

const initMutationObserver = () => {
    // if (mutationObserver) mutationObserver.disconnect();
    mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "childList") {
                mutation.addedNodes.forEach((node) => {
                    processNode(node, (node) => {
                        observeNode(node, false);
                    });
                });
            } else if (mutation.type === "attributes") {
                // if the src attribute of an image or video changes, process it
                const node = mutation.target;
                observeNode(node, mutation?.attributeName === "src");
            }
        });
    });
    startObserving();
};

const attachObserversListener = () => {
    listenToEvent("settingsLoaded", ({ detail: settings }) => {
        _settings = settings;
        if (!_settings.shouldDetect()) {
            mutationObserver?.disconnect();
            mutationObserver = null;
        } else {
            // if observing isn't already started, start it
            if (!mutationObserver) startObserving();
        }
    });
    listenToEvent("toggleOnOffStatus", () => {
        // console.log("HB== Observers Listener", _settings.shouldDetect());
        if (!_settings?.shouldDetect()) {
            // console.log("HB== Observers Listener", "disconnecting");
            mutationObserver?.disconnect();
            mutationObserver = null;
        } else {
            // if observing isn't already started, start it
            if (!mutationObserver) startObserving();
        }
    });

    // listen to message from background to tab
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "disable-detection") {
            videosInProcess
                .filter(
                    // filter videos that are playing, not disabled and in process
                    (video) =>
                        video.dataset.HBstatus === STATUSES.PROCESSING &&
                        !video.paused &&
                        video.currentTime > 0
                )
                .forEach((video) => {
                    disableVideo(video);
                });
        } else if (request.type === "enable-detection") {
            videosInProcess
                .filter(
                    (video) =>
                        video.dataset.HBstatus === STATUSES.DISABLED &&
                        !video.paused &&
                        video.currentTime > 0
                )
                .forEach((video) => {
                    enableVideo(video);
                });
        }
        return true;
    });
};

const killObserver = () => {
    mutationObserver?.disconnect();
    mutationObserver = null;
};

function observeNode(node, srcAttribute) {
    const isVideo = node.tagName === "VIDEO";
    if (
        !(
            (!isVideo && (_settings ? _settings.shouldDetectImages() : true)) ||
            (isVideo && (_settings ? _settings.shouldDetectVideos() : true))
        )
    )
        return;

    let sourceChildren = //some videos have source instead of src attribute
        isVideo ? node.getElementsByTagName("source")?.length : 0;
    const conditions =
        (srcAttribute || !node.dataset.HBstatus) && // has to have a new src attribute or no HBstatus (not processed yet)
        (node.src?.length > 0 || sourceChildren > 0) && // has to have a src attribute or source children
        (isVideo
            ? true
            : !isImageTooSmall(node) || node.height === 0 || node.width === 0); // if it's an image, it has to be big enough

    if (!conditions) {
        return;
    }

    applyBlurryStart(node);
    node.dataset.HBstatus = STATUSES.OBSERVED;

    if (node.src?.length || sourceChildren > 0) {
        // if there's no src attribute yet, wait for the mutation observer to catch it
        if (node.tagName === "IMG") processImage(node, STATUSES);
        else if (node.tagName === "VIDEO") {
            processVideo(node, STATUSES);
            videosInProcess.push(node);
            updateBGvideoStatus(videosInProcess);
        }
    } else {
        // remove the HBstatus if the node has no src attribute
        delete node.dataset?.HBstatus;
    }
}

export {
    attachObserversListener,
    initMutationObserver,
    STATUSES,
    killObserver,
};
