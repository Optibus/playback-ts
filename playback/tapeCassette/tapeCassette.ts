import { Recording } from "../recordings";

/**
 * An abstract class that acts as a storage driver for TapeRecorder to store and fetch recordings
 */
export abstract class TapeCassette {
  /**
   * Save given recording to the cassette, should be implemented by the derived class
   * @param recording - The recording to save
   */
  abstract saveRecordingImpl(recording: Recording): void;
  /**
   * Save given recording to the cassette
   * @param recording - The recording to save
   */
  saveRecording(recording: Recording) {
    this.saveRecordingImpl(recording);
    recording.close();
  }

  /**
   *  Get recording stored with the given id
   * @param recordingId - The recording id to retrieve
   * @returns the recording if found
   */
  abstract getRecording(recordingId: string): Recording | undefined;

  /**
   * Creates a new recording object. The recording id is generated by the derived cassette
   * @param category - A category to classify the recording in (e.g operation class)
   * @returns the new recording
   */
  abstract createNewRecording(category: string): Recording;

  /**
   * Aborts given recording without saving it
   * @param recording - recording to abort
   */
  public abortRecording(recording: Recording): void {
    recording.close();
  }
}
