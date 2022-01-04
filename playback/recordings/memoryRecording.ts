import {
  generatePlaybackException,
  PlaybackExceptionTypes,
} from "../exceptions";
import { MetaData } from "../types";
import { Recording } from "./recording";
export class MemoryRecording extends Recording {
  private recordingData: Record<string, any> = {};
  private recordingMetaData: MetaData = {};

  constructor(id?: string, recordingData?: string) {
    super(id);

    if (recordingData) {
      const memoryRecording = JSON.parse(recordingData) as MemoryRecording;

      this.recordingData = memoryRecording.recordingData;
      this.recordingMetaData = memoryRecording.recordingMetaData;
    }
  }

  setDataImpl(key: string, data: any): void {
    this.recordingData[key] = data;
  }
  public getData(key: string): any {
    if (!(key in this.recordingData)) {
      throw generatePlaybackException(
        `Key \'${key}\' not found in recording`,
        PlaybackExceptionTypes.RecordingKeyError
      );
    }

    return this.recordingData[key];
  }

  addMetadataImpl(metadata: MetaData): void {
    this.recordingMetaData = { ...this.recordingMetaData, ...metadata };
  }

  getMetadata(): MetaData {
    return this.recordingMetaData;
  }

  getAllKeys(): string[] {
    return Object.keys(this.recordingData);
  }
}
