import { Recording } from "playback/";

export abstract class TapeCassette {
  abstract saveRecordingImpl(recording: Recording): void;
  saveRecording(recording: Recording) {
    this.saveRecordingImpl(recording);
    recording.close();
  }

  abstract getRecording(recordingId: string): Recording | undefined;

  abstract createNewRecording(category: string): Recording;

  public abortRecording(recording: Recording): void {
    recording.close();
  }
}
