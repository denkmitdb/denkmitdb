import { HeadInterface } from "./head.js";

export interface SyncControllerInterface {
    start(newHead: (data: Uint8Array) => Promise<void>): Promise<void>;
    sendHead(head: HeadInterface): Promise<void>;
    addTask(task: () => Promise<void>): Promise<void>;
    addRepetitiveTask(task: () => Promise<void>, interval: number): Promise<void>;
    close(): Promise<void>;
}

