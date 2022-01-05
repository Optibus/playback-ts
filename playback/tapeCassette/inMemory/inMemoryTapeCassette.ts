import { v4 as uuid } from "uuid";
import { MemoryRecording, Recording } from "../../recordings";
import { TapeCassette } from "../tapeCassette";

/**
 *  Implementation of TapeCassette that saves everything in memory, mainly for playing around and testing
 *  and not meant for production use.
 */
export class InMemoryTapeCassette extends TapeCassette {
  readonly recordings: Record<string, string> = {};
  private lastId?: string;

  /**
   *  Saves given recording to the cassette
   * @param recording - The recording to save
   */
  saveRecordingImpl(recording: Recording): void {
    this.recordings[recording.id] = JSON.stringify(recording);
    this.lastId = recording.id;
  }

  /**
   * Create new in memory recording with semi random id (use category as prefix)
   * @param category - A category to classify the recording in (e.g operation class)
   * @returns the new recording
   */
  createNewRecording(category: string): Recording {
    return new MemoryRecording(`${category}/${uuid()}`);
  }

  /**
   * @returns the last recording id (if exists)
   */
  getLastRecordingId(): string | undefined {
    return this.lastId;
  }

  /**
   * @param recordingId - the recording id to retrieve
   * @returns the recording if found
   */
  getRecording(recordingId: string): Recording | undefined {
    const stringifiedRecording = this.recordings[recordingId];
    if (!stringifiedRecording) {
      return undefined;
    }
    return new MemoryRecording(recordingId, stringifiedRecording);
  }
}
