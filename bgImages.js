// bgImages.js
// EXPERIMENTAL: detect & blur CSS background images.
//
// Many sites (Google Images grid, Twitter timelines, some e-commerce
// listings) render thumbnails as `background-image` instead of <img>.
// HaramBlur currently ignores those entirely (issue #190).
//
// v1 scope & limitations (documented on purpose):
//  - only INLINE styles are scanned (`[style*="background"]`), because a
//    getComputedStyle() pass over every mutated subtree is too expensive.
//    Stylesheet-based backgrounds need a different strategy (see TODO).
//  - elements are blurred with a CSS filter on the whole element, which
//    also blurs any text on top of the background. Acceptable for a
//    privacy-first default; refine later with a pseudo-element overlay.
//  - only re-checks an element when its inline background-image actually
//    changes (tracked with a WeakMap on the element).

import { STATUSES } from "../constants.js";

const MIN_BG_ELEMENT_SIZE = 48; // skip icons/avatars-sized decorations
const BG_URL_RE = /url\((['"]?)(.*?)\1\)/i;

let bgStyleSheet = null;
const seenElements = new WeakMap(); // element -> last processed url

const ensureStyleSheet = () => {
    if (bgStyleSheet?.isConnected) return;
    bgStyleSheet = document.createElement("style");
    bgStyleSheet.id = "hb-bg-stylesheet";
    document.head?.appendChild(bgStyleSheet);
};

export const setBgBlurStyle = ({ blurAmount, gray }) => {
    ensureStyleSheet();
    bgStyleSheet.innerHTML = `
        .hb-bg-blur {
            filter: blur(${blurAmount}px) ${gray ? "grayscale(100%)" : ""} !important;
            transition: filter 0.1s ease !important;
        }
    `;
};

const isBigEnough = (el) => {
    const rect = el.getBoundingClientRect?.() ?? { width: 0, height: 0 };
    return (
        rect.width >= MIN_BG_ELEMENT_SIZE && rect.height >= MIN_BG_ELEMENT_SIZE
    );
};

const extractBackgroundUrl = (el) => {
    const style = el.getAttribute?.("style") ?? "";
    if (!style.toLowerCase().includes("background")) return null;
    const match = style.match(BG_URL_RE);
    const url = match?.[2];
    if (!url) return null;
    // skip tiny inline data URIs (usually 1x1 tracking spacers / icons)
    if (url.startsWith("data:") && url.length < 100) return null;
    return url;
};

const processBgElement = (el) => {
    let url;
    try {
        url = extractBackgroundUrl(el);
    } catch {
        return;
    }
    if (!url || !isBigEnough(el)) return;
    if (seenElements.get(el) === url) return; // unchanged since last check
    seenElements.set(el, url);

    el.dataset.HBbgStatus = STATUSES.PROCESSING;
    const rect = el.getBoundingClientRect();

    chrome.runtime.sendMessage(
        {
            type: "imageDetection",
            image: {
                src: url,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
        },
        (response) => {
            if (chrome.runtime.lastError || response?.type === "error") {
                el.dataset.HBbgStatus = STATUSES.ERROR;
                return;
            }
            el.dataset.HBbgStatus = STATUSES.PROCESSED;
            if (response === "face" || response === "nsfw") {
                el.classList.add("hb-bg-blur");
            } else if (response === false) {
                el.classList.remove("hb-bg-blur");
            }
        }
    );
};

/**
 * Scan a mutated node (and its subtree) for elements that carry an
 * inline CSS background-image, and run them through the same
 * detection pipeline used for <img> tags.
 */
export const processNodeBackgrounds = (node) => {
    if (!node?.querySelectorAll) return;
    try {
        const candidates =
            node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.("style")
                ? [node, ...node.querySelectorAll('[style*="background"]')]
                : [...node.querySelectorAll('[style*="background"]')];
        candidates.forEach(processBgElement);
    } catch (e) {
        // never let the experimental module break the main observer
        console.log("HB==bgImages error", e);
    }
};
