import { assert } from "console";
import { v4 as uuid } from "uuid";
import { MetaData } from "../types";
export abstract class Recording {
  readonly id: string;
  protected closed: boolean;
  constructor(id?: string) {
    this.id = id || uuid();
    this.closed = false;
  }

  abstract setDataImpl(key: string, data: any): void;
  public setData(key: string, data: any): void {
    assert(!this.closed, "Recording is closed");
    this.setDataImpl(key, data);
  }
  public abstract getData(key: string): any;

  public abstract getAllKeys(): string[];

  public close(): void {
    this.closed = true;
  }

  abstract addMetadataImpl(metadata: MetaData): void;
  addMetadata(metadata: MetaData) {
    assert(!this.closed, "Recording is closed");
    this.addMetadataImpl(metadata);
  }

  abstract getMetadata(): MetaData;
}
