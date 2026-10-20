import { loadImage } from "./helpers.js";

class Queue {
    constructor(runDetectionFn) {
        this.loadingQueue = [];
        this.detectionQueue = [];
        this.queuingStarted = false;
        this.activeProcessing = 0;
        this.activeLoading = 0;
        this.maxLoading = 100;
        this.maxProcessing = 1;
        this.runDetection = runDetectionFn;
    }

    async handleElementLoading(img, onSuccess, onError) {
        try {
            const node = await loadImage(img.src, img.width, img.height);
            this.processNextElement(node, onSuccess, onError);
        } catch (error) {
            console.error("HB=== image failed to load", img.src);
            onError({
                message: "Failed to load image",
                error,
            });
        } finally {
            this.activeLoading--;
            // if there are more images to load, load them
            if (this.loadingQueue.length) {
                this.handleElementLoading(...this.loadingQueue.shift());
            }
        }
    }

    async handleElementProcessing(node, onSuccess, onError) {
        try {
            const result = await this.runDetection(node);
            // console.log("offscreen result", result);
            onSuccess(result);
        } catch (error) {
            console.error("Offscreen== handleElementProcessing error", error);
            onError({
                message: "Failed to process image",
                error,
            });
        } finally {
            this.activeProcessing--;
            node.src = "";
            node = null;
            // if there are more images to process, process them
            if (this.detectionQueue.length) {
                this.handleElementProcessing(...this.detectionQueue.shift());
            }
        }
    }

    async processNextElement(node, onSuccess, onError) {
        try {
            if (this.activeProcessing < this.maxProcessing) {
                this.activeProcessing++;
                this.handleElementProcessing(node, onSuccess, onError);
            } else {
                this.detectionQueue.push([node, onSuccess, onError]);
            }
        } catch (error) {
            console.error("Offscreen== processNextElement error", error);
        }
    }

    async add(img, onSuccess, onError) {
        try {
            if (this.activeLoading < this.maxLoading) {
                this.activeLoading++;
                this.handleElementLoading(img, onSuccess, onError);
            } else {
                this.loadingQueue.push([img, onSuccess, onError]);
            }
        } catch (error) {
            console.error("HB== addToQueue error", error);
        }
    }
}

export default Queue;
