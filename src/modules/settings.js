import { emitEvent } from "./helpers.js";
import { DEFAULT_SETTINGS } from "../constants.js";

class Settings {
    /*
     * @private
     */
    constructor(settings = DEFAULT_SETTINGS) {
        this._settings = settings;
    }

    shouldDetectMale() {
        if (!this._settings.status) return false;
        return this._settings.blurMale;
    }

    shouldDetectFemale() {
        if (!this._settings.status) return false;
        return this._settings.blurFemale;
    }

    shouldDetectGender() {
        if (!this._settings.status) return false;
        return this.shouldDetectMale() || this.shouldDetectFemale();
    }

    shouldDetectImages() {
        if (!this._settings.status) return false;
        return this._settings.blurImages;
    }

    shouldDetectVideos() {
        if (!this._settings.status) return false;
        return this._settings.blurVideos;
    }

    // alias
    shouldBlurImages() {
        return this.shouldDetectImages();
    }

    // alias
    shouldBlurVideos() {
        return this.shouldDetectVideos();
    }

    shouldUnblurImages() {
        if (!this._settings.status) return false;
        return this._settings.unblurImages;
    }

    shouldUnblurVideos() {
        if (!this._settings.status) return false;
        return this._settings.unblurVideos;
    }

    shouldDetect() {
        if (!this._settings.status) return false;
        return this.shouldDetectImages() || this.shouldDetectVideos();
    }

    isBlurryStartMode() {
        if (!this.shouldDetect()) return false;
        return this._settings.blurryStartMode;
    }

    getBlurAmount() {
        if (!this.shouldDetect()) return 0;
        return this._settings.blurAmount;
    }

    getStrictness() {
        if (!this.shouldDetect()) return 0;
        return this._settings.strictness;
    }

    isGray() {
        if (!this.shouldDetect()) return false;
        return this._settings.gray;
    }

    getWhitelist() {
        return this._settings.whitelist;
    }

    getSettings() {
        return this._settings;
    }

    setSettings(settings) {
        this._settings = settings;
    }

    toggleOnOffStatus() {
        if (
            !this._settings.whitelist?.includes(
                window.location.hostname?.split("www.")?.[1] ??
                    window.location.hostname
            )
        ) {
            emitEvent("toggleOnOffStatus", this);
        }
    }

    listenForChanges() {
        chrome.runtime.onMessage.addListener(
            (request, sender, sendResponse) => {
                if (request.type === "updateSettings") {
                    this.updateSettings(request.newSetting);
                }
                return true;
            }
        );
    }
    // this acts as an async constructor
    static async init(_loadedSettings = null) {
        const loadedSettings =
            _loadedSettings ??
            (await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { type: "getSettings" },
                    (settings) => {
                        resolve(settings);
                    }
                );
            }));
        const settings = new Settings(loadedSettings);
        settings.listenForChanges();
        emitEvent("settingsLoaded", settings);
        return settings;
    }

    updateSettings(newSetting) {
        const { key, value } = newSetting;

        this._settings[key] = value;
        switch (key) {
            case "status":
                this.toggleOnOffStatus();
                break;
            case "blurAmount":
                emitEvent("changeBlurAmount", this);
                break;
            case "gray":
                emitEvent("changeGray", this);
                break;
        }
    }
}

export default Settings;
