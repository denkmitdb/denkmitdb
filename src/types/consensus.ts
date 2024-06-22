import { RulesLogic } from "json-logic-js";
import { CID } from "multiformats/cid";
import { DenkmitMetadata, HeliaControllerInterface } from "./utils";

export const CONSENSUS_VERSION = 1;
export type ConsensusVersionType = typeof CONSENSUS_VERSION;

/**
 * Represents the type of a Database consensus.
 */
/**
 * Represents the data for a consensus.
 */
export type ConsensusData = {
    /**
     * The version of the consensus.
     */
    readonly version: ConsensusVersionType;

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

export type ConsensusType = ConsensusData & DenkmitMetadata;

export interface ConsensusControllerInterface extends ConsensusType {
    toJSON(): ConsensusData;
    execute(data: unknown): Promise<boolean>;
}

export declare function createConsensus(
    consensus: ConsensusData,
    heliaController: HeliaControllerInterface,
): Promise<ConsensusControllerInterface>;
export declare function fetchConsensus(
    cid: CID,
    heliaController: HeliaControllerInterface,
): Promise<ConsensusControllerInterface>;
