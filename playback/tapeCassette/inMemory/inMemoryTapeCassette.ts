import { v4 as uuid } from "uuid";
import { MemoryRecording, Recording } from "../../recordings";
import { TapeCassette } from "../tapeCassette";

export class InMemoryTapeCassette extends TapeCassette {
  readonly recordings: Record<string, string> = {};
  private lastId?: string;

  saveRecordingImpl(recording: Recording): void {
    this.recordings[recording.id] = JSON.stringify(recording);
    this.lastId = recording.id;
  }

  createNewRecording(category: string): Recording {
    return new MemoryRecording(`${category}/${uuid()}`);
  }

  getLastRecordingId(): string | undefined {
    return this.lastId;
  }

  getRecording(recordingId: string): Recording | undefined {
    const stringifiedRecording = this.recordings[recordingId];
    if (!stringifiedRecording) {
      return undefined;
    }
    return new MemoryRecording(recordingId, stringifiedRecording);
  }
}
