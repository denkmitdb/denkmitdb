import { RulesLogic } from "json-logic-js";
import { CID } from "multiformats/cid";
import { DenkmitMetadata, HeliaControllerInterface } from "./utils";

export const CONSENSUS_VERSION = 1;
export type ConsensusVersionType = typeof CONSENSUS_VERSION;

/**
 * Represents the type of a Database consensus.
 */
export type ConsensusData = {
    /**
     * The version of the consensus.
     */
    readonly version: ConsensusVersionType;

    /**
     * The consensus logic.
     */
    readonly logic: RulesLogic;
};

export type ConsensusType = ConsensusData & DenkmitMetadata;

export interface ConsensusInterface extends ConsensusType {
    toJSON(): ConsensusData;
    execute(data: unknown): Promise<boolean>;
}

export declare function createConsensus(consensus: ConsensusData, heliaController:HeliaControllerInterface): Promise<ConsensusInterface>;
export declare function fetchConsensus(cid: CID, heliaController:HeliaControllerInterface): Promise<ConsensusInterface>;
