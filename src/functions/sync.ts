import type { Logger, Message } from "@libp2p/interface";
import delay from "delay";
import PQueue from "p-queue";
import { HeadInterface, HeliaControllerInterface } from "src/types";
import { SyncControllerInterface } from "src/types";

/**
 * Represents a SyncController that handles synchronization operations.
 */
export class SyncController implements SyncControllerInterface {
    heliaController: HeliaControllerInterface;
    name: string;
    queue: PQueue = new PQueue({ concurrency: 1 });
    schdeduleQueue: PQueue = new PQueue({ concurrency: 1 });
    newHead?: (data: Uint8Array) => Promise<void>;
    private log: Logger;

    constructor(heliaController: HeliaControllerInterface, name: string) {
        this.heliaController = heliaController;
        this.name = name;
        this.log = heliaController.helia.logger.forComponent("denkmitdb:sync");
    }

    newMessage(message: CustomEvent<Message>): void {
        this.log("newMessage %o", message);
        const data = message.detail.data;
        this.log("newMessage data %o", data);
        if (this.newHead) this.newHead(data);
    }

    async start(newHead: (data: Uint8Array) => Promise<void>): Promise<void> {
        this.log("Start sync controller");
        this.newHead = newHead;
        this.log("Subscribe to %s", this.name);
        this.log("Function", { newHead: this.newHead });

        this.heliaController.libp2p.services.pubsub.addEventListener("message", (message) => this.newMessage(message));
        this.heliaController.libp2p.services.pubsub.addEventListener("subscription-change", async (data) => {
            this.log("subscription-change", { data });
        });
        this.heliaController.libp2p.services.pubsub.subscribe(this.name);
    }

    async sendHead(head: HeadInterface): Promise<void> {
        this.heliaController.libp2p.services.pubsub.publish(this.name, head.cid.bytes);
    }

    async addTask(task: () => Promise<void>): Promise<void> {
        this.queue.add(task);
    }

    async addRepetitiveTask(task: () => Promise<void>, interval: number): Promise<void> {
        this.log("addRepetitiveTask %d", interval);
        this.schdeduleQueue.add(() => delay(interval));
        this.schdeduleQueue.add(() => this.addTask(task));
        this.schdeduleQueue.add(() => this.addRepetitiveTask(task, interval));
    }

    async close(): Promise<void> {
        this.queue.clear();
        this.schdeduleQueue.clear();
        this.heliaController.libp2p.services.pubsub.unsubscribe(this.name);
        this.heliaController.libp2p.services.pubsub.removeEventListener("message");
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
    heliaController: HeliaControllerInterface,
): Promise<SyncControllerInterface> {
    return new SyncController(heliaController, name);
}
