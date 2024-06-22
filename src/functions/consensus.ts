import { RulesLogic, apply } from 'json-logic-js';
import { CID } from 'multiformats/cid';
import { ConsensusData, ConsensusInterface, ConsensusType, ConsensusVersionType } from 'src/types/consensus';

export type ConsensusCheckData = {
    currentTimestamp: number;
    databaseCreator: CID;
    currentIdentity: CID;
    entryTimestamp: number;
    entryCreator: CID;
}

export class ConsensusController implements ConsensusInterface {
    version: ConsensusVersionType;
    logic: RulesLogic;

    cid: CID;
    creator: CID;

    constructor(consensus: ConsensusType) {
        this.version = consensus.version;
        this.logic = consensus.logic;
        this.cid = consensus.cid;
        this.creator = consensus.creator;
    }

    toJSON(): ConsensusData {
        return {
            version: this.version,
            logic: this.logic
        };
    }

    async execute(data: ConsensusCheckData): Promise<boolean> {
        return apply(this.logic, data);
    }
}