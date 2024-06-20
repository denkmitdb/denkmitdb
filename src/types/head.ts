import { CID } from 'multiformats/cid';
import { HeliaStorage } from 'src/functions';
import { DenkmitMetadata } from './utils';

export const HEAD_VERSION = 1;
export type HeadVersionType = typeof HEAD_VERSION;

export type HeadData = {
  readonly version: HeadVersionType;
  readonly manifest: CID;
  readonly root: CID;
  readonly timestamp: number;
  readonly layers: number;
  readonly size: number;
};

export type HeadType = HeadData & DenkmitMetadata;

export interface HeadInterface extends HeadType {
}

export declare function createHead(head: HeadData, heliaStorage:HeliaStorage): Promise<HeadInterface>;
export declare function fetchHead(cid: CID, heliaStorage: HeliaStorage): Promise<HeadInterface>;
