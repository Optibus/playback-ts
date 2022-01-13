import {
  generatePlaybackException,
  PlaybackExceptionTypes,
} from "../exceptions";
import { MetaData } from "../types";
import { Recording } from "./recording";

/**
 * This class represents a memory recording of playback operations.
 * the MemoryRecording store the data in in-memory record
 */
export class MemoryRecording extends Recording {
  private recordingData: Record<string, any> = {};
  private recordingMetaData: MetaData = {};

  /**
   * @param id The
   * @param recordingData On fetched recording this should contain the recorded data
   */
  constructor(id?: string, recordingData?: string) {
    super(id);

    if (recordingData) {
      const memoryRecording = JSON.parse(recordingData) as MemoryRecording;

      this.recordingData = memoryRecording.recordingData;
      this.recordingMetaData = memoryRecording.recordingMetaData;
    }
  }

  /**
   * Store data in the recording.
   * @param key the data key
   * @param data the data to store
   */
  setDataImpl(key: string, data: any): void {
    this.recordingData[key] = data;
  }

  /**
   *
   * @param key data key
   * @returns Recorded data under given key
   */
  public getData(key: string): any {
    if (!(key in this.recordingData)) {
      throw generatePlaybackException(
        PlaybackExceptionTypes.RecordingKeyError,
        `Key \'${key}\' not found in recording`
      );
    }

    return this.recordingData[key];
  }

  /**
   * set the recording metadata
   * @param metadata
   */
  addMetadataImpl(metadata: MetaData): void {
    this.recordingMetaData = { ...this.recordingMetaData, ...metadata };
  }

  /**
   * @returns the recording metadata
   */
  getMetadata(): MetaData {
    return this.recordingMetaData;
  }

  /**
   * @returns all the records keys
   */
  getAllKeys(): string[] {
    return Object.keys(this.recordingData);
  }
}
