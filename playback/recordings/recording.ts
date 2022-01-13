import { assert } from "console";
import { v4 as uuid } from "uuid";
import { MetaData } from "../types";

/**
 * Holds a recording of an operation that was recorded using the TapeRecorder
 * This is an abstract class that should be extended to create a specific recording
 */
export abstract class Recording {
  readonly id: string;
  protected closed: boolean;

  /**
   * @param id of the recording
   * @default auto generated id
   */
  constructor(id?: string) {
    this.id = id || uuid();
    this.closed = false;
  }

  /**
   * Sets data in the recording. should be implemented by the derived class
   * @param key the key to set
   * @param data the data to store
   */
  abstract setDataImpl(key: string, data: any): void;

  /**
   * Sets data in the recording
   * @param key the key to set
   * @param data the data to store
   */
  public setData(key: string, data: any): void {
    assert(!this.closed, "Recording is closed");
    this.setDataImpl(key, data);
  }
  /**
   * Retrieve data from the recording
   * @param key the data key to retrieve
   * @throws RecordingKeyError if the key is not found
   */
  public abstract getData(key: string): any;

  /**
   * returns the recording data keys
   */
  public abstract getAllKeys(): string[];

  /**
   * close the recording and prevent further changes
   */
  public close(): void {
    this.closed = true;
  }

  /**
   * add metadata to the recording, could override existing metadata properties
   * should be implemented by the derived class
   * @param metadata the metadata to add
   */
  abstract addMetadataImpl(metadata: MetaData): void;

  /**
   * add metadata to the recording, could override existing metadata properties
   * @param metadata the metadata to add
   */
  addMetadata(metadata: MetaData) {
    assert(!this.closed, "Recording is closed");
    this.addMetadataImpl(metadata);
  }

  /**
   * Return the recording metadata.
   * should be implemented by the derived class
   */
  abstract getMetadata(): MetaData;
}
