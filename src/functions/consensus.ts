import type { RulesLogic } from "json-logic-js";
import jsonLogic from "json-logic-js";
import { CID } from "multiformats/cid";
import { DenkmitData, HeliaControllerInterface } from "src/types";
import { ConsensusData, ConsensusControllerInterface, ConsensusVersionType } from "src/types/consensus";

// export type ConsensusCheckData = {
//     currentTimestamp: number;
//     databaseCreator: CID;
//     currentIdentity: CID;
//     entryTimestamp: number;
//     entryCreator: CID;
// }

export type ConsensusCheckData = Record<string, number | string>;

export class ConsensusController implements ConsensusControllerInterface {
    version: ConsensusVersionType;
    name: string;
    description: string;
    logic: RulesLogic;

    cid: CID;
    creator: CID;

    constructor(consensus: DenkmitData<ConsensusData>) {
        this.version = consensus.data.version;
        this.name = consensus.data.name;
        this.description = consensus.data.description;
        this.logic = consensus.data.logic;
        this.cid = consensus.cid;
        this.creator = consensus.creator;
    }

    toJSON(): ConsensusData {
        return {
            version: this.version,
            name: this.name,
            description: this.description,
            logic: this.logic,
        };
    }

    async execute(data: ConsensusCheckData): Promise<boolean> {
        return jsonLogic.apply(this.logic, data);
    }
}

export async function createConsensus(
    consensus: ConsensusData,
    heliaController: HeliaControllerInterface,
): Promise<ConsensusControllerInterface> {
    const result = await heliaController.addSignedV2(consensus);
    return new ConsensusController(result);
}

export async function fetchConsensus(
    cid: CID,
    heliaController: HeliaControllerInterface,
): Promise<ConsensusControllerInterface> {
    const result = await heliaController.getSignedV2<ConsensusData>(cid);
    if (!result || !result.data) throw new Error("Consensus not found");
    return new ConsensusController(result);
}
