import type { Message } from "@libp2p/floodsub";
import type { Logger } from "@libp2p/interface";
import delay, { clearDelay } from "delay";
import PQueue from "p-queue";
import type { Head } from "./head.js";
import type { HeliaController } from "./storage/helia.js";

/**
 * Represents a SyncController that handles synchronization operations.
 */
export class SyncController {
    heliaController: HeliaController;
    name: string;
    queue: PQueue = new PQueue({ concurrency: 1 });
    scheduleQueue: PQueue = new PQueue({ concurrency: 1 });
    newHead?: (data: Uint8Array) => Promise<void>;
    private log: Logger;
    private closed = false;
    // Bound handler references so they can actually be removed on close
    // (KNOWN_ISSUES.md #9). An inline arrow can't be removed later.
    private readonly messageHandler = (event: CustomEvent<Message>) => this.newMessage(event);
    private readonly subscriptionChangeHandler = (event: unknown) => this.log("subscription-change %o", event);
    private repetitiveDelay?: Promise<void>;

    constructor(heliaController: HeliaController, name: string) {
        this.heliaController = heliaController;
        this.name = name;
        this.log = heliaController.helia.logger.forComponent("denkmitdb:sync");
    }

    newMessage(message: CustomEvent<Message>): void {
        // Only react to messages on this database's topic — the listener fires for
        // every subscribed topic on the node (KNOWN_ISSUES.md #4).
        if (message.detail.topic !== this.name) return;
        if (!this.newHead) return;
        // newHead is async; swallow (log) rejections so a bad message can't become
        // an unhandled rejection (KNOWN_ISSUES.md #14).
        this.newHead(message.detail.data).catch((error) => this.log.error?.("newHead failed", error));
    }

    async start(newHead: (data: Uint8Array) => Promise<void>): Promise<void> {
        this.log("Start sync controller, subscribe to %s", this.name);
        this.newHead = newHead;

        this.heliaController.libp2p.services.pubsub.addEventListener("message", this.messageHandler);
        this.heliaController.libp2p.services.pubsub.addEventListener("subscription-change", this.subscriptionChangeHandler);
        this.heliaController.libp2p.services.pubsub.subscribe(this.name);
    }

    async sendHead(head: Head): Promise<void> {
        await this.heliaController.libp2p.services.pubsub.publish(this.name, head.cid.bytes);
    }

    /** Resolves when the task queue has drained. */
    async onIdle(): Promise<void> {
        await this.queue.onIdle();
    }

    async addTask(task: () => Promise<void>): Promise<void> {
        if (this.closed) return;
        try {
            await this.queue.add(async () => {
                try {
                    await task();
                } catch (error) {
                    // A failing background task must not crash the process
                    // (KNOWN_ISSUES.md #14); surface it on the logger instead.
                    this.log.error?.("sync task failed", error);
                }
            });
        } catch (error) {
            // p-queue 10 rejects the promise of a task dropped by clear() (on close)
            // with an AbortError; p-queue 9 left it pending forever. A dropped task is
            // expected during shutdown, and callers may not await this promise, so it
            // must not surface as an unhandled rejection.
            if ((error as Error)?.name !== "AbortError") throw error;
            this.log("task dropped: queue cleared on close");
        }
    }

    async addRepetitiveTask(task: () => Promise<void>, interval: number): Promise<void> {
        // Start the timer loop in the background and return immediately, so callers
        // (e.g. setupSync) don't block for `interval`.
        void this.runRepetitive(task, interval);
    }

    private async runRepetitive(task: () => Promise<void>, interval: number): Promise<void> {
        while (!this.closed) {
            this.repetitiveDelay = delay(interval);
            await this.repetitiveDelay; // resolves on the timer, or early via close()'s clear()
            if (this.closed) break;
            await this.addTask(task);
        }
    }

    async close(): Promise<void> {
        this.closed = true;
        if (this.repetitiveDelay) clearDelay(this.repetitiveDelay);
        this.queue.clear();
        this.scheduleQueue.clear();
        const pubsub = this.heliaController.libp2p.services.pubsub;
        pubsub.removeEventListener("message", this.messageHandler);
        pubsub.removeEventListener("subscription-change", this.subscriptionChangeHandler);
        try {
            pubsub.unsubscribe(this.name);
        } catch (error) {
            // A stopped libp2p node throws "Pubsub is not started"; its subscriptions
            // are already gone, so teardown carries on (KNOWN_ISSUES.md #28).
            this.log("unsubscribe skipped: %s", (error as Error).message);
        }
        await this.queue.onIdle();
    }
}

/**
 * Creates a sync controller with the specified name and Helia controller.
 * @param name - The name of the sync controller.
 * @param heliaController - The Helia controller to associate with the sync controller.
 * @returns A promise that resolves to the created SyncController instance.
 */
export async function createSyncController(
    name: string,
    heliaController: HeliaController,
): Promise<SyncController> {
    return new SyncController(heliaController, name);
}
