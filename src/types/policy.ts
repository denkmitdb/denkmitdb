import { RulesLogic } from "json-logic-js";
import { DenkmitMetadata } from "./utils.js";

export const POLICY_VERSION = 1;
export type PolicyVersionType = typeof POLICY_VERSION;

/**
 * Represents the type of a Database consensus.
 */
/**
 * Represents the data for a consensus.
 */
export type PolicyData = {
    /**
     * The version of the consensus.
     */
    readonly version: PolicyVersionType;

    /**
     * The name of the consensus.
     */
    readonly name: string;

    /**
     * The description of the consensus.
     */
    readonly description: string;

    /**
     * The consensus logic.
     */
    readonly logic: RulesLogic;
};

export type ConsensusType = PolicyData & DenkmitMetadata;

export interface PolicyInterface extends ConsensusType {
    toJSON(): PolicyData;
    execute(data: unknown): Promise<boolean>;
}

