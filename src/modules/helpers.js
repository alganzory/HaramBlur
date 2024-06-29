// import { STATUSES } from "./observers";

import { STATUSES } from "../constants.js";

const MAX_IMG_HEIGHT = 300;
const MAX_IMG_WIDTH = 400;
const MIN_IMG_WIDTH = 32;
const MIN_IMG_HEIGHT = 32;
// maintain 1920x1080 aspect ratio
const MAX_VIDEO_WIDTH = 1920 / 4.5;
const MAX_VIDEO_HEIGHT = 1080 / 4.5;

const loadImage = async (imgSrc, imgWidth, imgHeight) => {
    // let { newWidth, newHeight } = calcResize(imgWidth, imgHeight);
    // TODO: use the newWidth and newHeight to resize the image (for some reason it's a lot slower when I do that)
    const img = new Image(224, 224);
    return await new Promise((resolve, reject) => {
        img.setAttribute("crossorigin", "anonymous");

        img.onload = () => {
            resolve(img);
        };

        img.onerror = (e) => {
            reject(e);
        };

        try {
            img.src = imgSrc;
        } catch (e) {
            reject(e);
        }
    });
};

const loadVideo = async (video) => {
    // TODO: check if video is too small resolve false

    return await new Promise((resolve, reject) => {
        video.setAttribute("crossorigin", "anonymous");
        if (video.readyState >= 3 && video.videoHeight) {
            resolve(true);
        }
        video.onloadeddata = () => {
            video.videoHeight ? resolve(true) : reject();
        };
        video.onerror = (e) => {
            // console.error("Failed to load video", video);
            reject("Failed to load video", video);
        };
    });
};

const isImageTooSmall = (img) => {
    return img.width < MIN_IMG_WIDTH || img.height < MIN_IMG_HEIGHT;
};

const calcResize = (width, height, type = "image") => {
    let newWidth = width;
    let newHeight = height;

    if (!width || !height) return { newWidth, newHeight };

    let actualMaxWidth = type === "image" ? MAX_IMG_WIDTH : MAX_VIDEO_WIDTH;
    let actualMaxHeight = type === "image" ? MAX_IMG_HEIGHT : MAX_VIDEO_HEIGHT;

    // if the aspect ratio is reversed (portrait image/video), swap max width and max height
    if (newWidth < newHeight) {
        const temp = actualMaxWidth;
        actualMaxWidth = actualMaxHeight;
        actualMaxHeight = temp;
    }

    // if image is smaller than max size, don't resize
    if (!(newWidth < actualMaxWidth && newHeight < actualMaxHeight)) {
        // calculate new width to resize image to
        const ratio = Math.min(
            actualMaxWidth / newWidth,
            actualMaxHeight / newHeight
        );
        newWidth = newWidth * ratio;
        newHeight = newHeight * ratio;
    }

    return { newWidth, newHeight };
};

const hasBeenProcessed = (element) => {
    if (!element) throw new Error("No element provided");
    if (
        element.dataset.HBstatus &&
        element.dataset.HBstatus >= STATUSES.PROCESSING
    )
        return true;
    return false;
};

const processNode = (node, callBack) => {
    // if the node has any images or videos as children, add them to the array
    const imgs = node?.getElementsByTagName?.("img") ?? [];

    const videos = node?.getElementsByTagName?.("video") ?? [];

    // process each image/video
    // nodes that don't get callback (observed) are:
    // 1. images
    // 1.1. that are too small (but we have to make sure they have loaded first, cause they might be too small because they haven't loaded yet)

    for (let i = 0; i < imgs.length + videos.length; i++) {
        const node = i < imgs.length ? imgs[i] : videos[i - imgs.length];
        if (node.tagName === "VIDEO") {
            callBack(node);
        } else if (node.tagName === "IMG") {
            // (like a 1x1 pixel image, icon, etc.) don't process it
            node.complete && isImageTooSmall(node) && node.naturalHeight
                ? null
                : callBack(node);
        }
    }

    if (node.tagName === "IMG" || node.tagName === "VIDEO") {
        callBack(node);
    }
};

const resetElement = (element) => {
    // remove crossOrigin attribute
    element.removeAttribute("crossOrigin");
    // remove blur class
    element.classList.remove("hb-blur-temp");
    element.classList.remove("hb-blur");
};

const emitEvent = (eventName, detail = "") => {
    const event = new CustomEvent(eventName, { detail });
    document.dispatchEvent(event);
};

const listenToEvent = (eventName, callBack) => {
    document.addEventListener(eventName, callBack);
};

const now = () => {
    return performance?.now?.() || Date.now();
};

const timeTaken = (fnToRun) => {
    const beforeRun = now();
    fnToRun();
    const afterRun = now();
    return afterRun - beforeRun;
};

const getCanvas = (width, height, offscreen = true) => {
    let c;

    if (!offscreen) {
        c =
            document.getElementById("hb-in-canvas") ??
            document.createElement("canvas");
        c.id = "hb-in-canvas";
        c.width = width;
        c.height = height;
        // uncomment this to see the canvas (debugging)
        // c.style.position = "absolute";
        // c.style.top = "0";
        // c.style.left = "0";
        // c.style.zIndex = 9999;

        // if it's not appended to the DOM, append it
        if (!c.parentElement) {
            document.body.appendChild(c);
        }
    } else {
        c = new OffscreenCanvas(width, height);
    }

    return c;
};

const canvToBlob = (canv, options) => {
    //if it's an offscreen canvas
    if (canv.convertToBlob) {
        return canv.convertToBlob(options);
    }
    return new Promise((resolve, reject) => {
        canv.toBlob(
            (blob) => {
                resolve(blob);
            },
            options?.type || "image/jpeg",
            options?.quality || 0.8
        );
    });
};

const disableVideo = (video) => {
    video.dataset.HBstatus = STATUSES.DISABLED;
    video.classList.remove("hb-blur");
};

const enableVideo = (video) => {
    video.dataset.HBstatus = STATUSES.PROCESSING;
};

function updateBGvideoStatus(videosInProcess) {
    // checks if there are any disabled videos in the videosInProcess array, sends a message to the background to disable/enable the extension icon
    const disabledVideos =
        videosInProcess.filter(
            (video) =>
                video.dataset.HBstatus === STATUSES.DISABLED &&
                !video.paused &&
                video.currentTime > 0
        ) ?? [];

    chrome.runtime.sendMessage({
        type: "video-status",
        status: disabledVideos.length === 0,
    });
}

const requestIdleCB =
    window.requestIdleCallback ||
    function (cb) {
        var start = Date.now();
        return setTimeout(function () {
            cb({
                didTimeout: false,
                timeRemaining: function () {
                    return Math.max(0, 50 - (Date.now() - start));
                },
            });
        }, 1);
    };

const cancelIdleCB =
    window.cancelIdleCallback ||
    function (id) {
        clearTimeout(id);
    };

export {
    loadImage,
    loadVideo,
    calcResize,
    hasBeenProcessed,
    processNode,
    emitEvent,
    listenToEvent,
    now,
    timeTaken,
    resetElement,
    isImageTooSmall,
    getCanvas,
    disableVideo,
    enableVideo,
    updateBGvideoStatus,
    requestIdleCB,
    cancelIdleCB,
    canvToBlob,
};
