import type { RulesLogic } from "json-logic-js";
import jsonLogic from "json-logic-js";
import { CID } from "multiformats/cid";
import { DenkmitData, HeliaControllerInterface } from "../types/index.js";
import { PolicyData, PolicyInterface, PolicyVersionType } from "../types/policy.js";

export type PolicyInput = Record<string, number | string>;

export class PolicyController implements PolicyInterface {
    version: PolicyVersionType;
    name: string;
    description: string;
    logic: RulesLogic;

    cid: CID;
    creator: CID;

    constructor(consensus: DenkmitData<PolicyData>) {
        this.version = consensus.data.version;
        this.name = consensus.data.name;
        this.description = consensus.data.description;
        this.logic = consensus.data.logic;
        this.cid = consensus.cid;
        this.creator = consensus.creator;
    }

    toJSON(): PolicyData {
        return {
            version: this.version,
            name: this.name,
            description: this.description,
            logic: this.logic,
        };
    }

    async execute(data: PolicyInput): Promise<boolean> {
        return jsonLogic.apply(this.logic, data);
    }
}

export async function createPolicy(
    consensus: PolicyData,
    heliaController: HeliaControllerInterface,
): Promise<PolicyInterface> {
    const result = await heliaController.addSigned(consensus);
    return new PolicyController(result);
}

export async function fetchPolicy(
    cid: CID,
    heliaController: HeliaControllerInterface,
): Promise<PolicyInterface> {
    const result = await heliaController.getSigned<PolicyData>(cid);
    if (!result || !result.data) throw new Error("Consensus not found");
    return new PolicyController(result);
}
