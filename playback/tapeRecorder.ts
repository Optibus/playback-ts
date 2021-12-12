import assert from "assert";
import {
  OperationExceptionDuringPlayback,
  TapeRecorderException,
} from "./exceptions";
import { Recording } from "./recordings/recording";
import { TapeCassette } from "./tapeCassette";
import { MetaData, Output, Playback } from "./types";

export const OPERATION_OUTPUT_ALIAS = `_tape_recorder_operation`;
export const DURATION = "_tape_recorder_recording_duration";
export const RECORDED_AT = "_tape_recorder_recorded_at";
export const EXCEPTION_IN_OPERATION = "_tape_recorder_exception_in_operation";

export class TapeRecorder {
  readonly tapeCassette: TapeCassette;
  private playbackRecording: any;
  private recordingEnabled: boolean = false;
  private playbackOutput: Output[] = [];
  private activeRecording?: Recording = undefined;
  private invokeCounter: Record<string, number> = {};

  constructor(tapeCassette: TapeCassette) {
    this.tapeCassette = tapeCassette;
  }

  enableRecording() {
    console.info("Enabling recording");
    this.recordingEnabled = true;
  }

  play(recordingId: string, playbackFunction: Function): Playback {
    const recording = this.tapeCassette.getRecording(recordingId);
    assert(recording !== undefined, "Recording not found");
    this.playbackRecording = recording;
    const start = Date.now();

    let playbackDuration;
    let playbackOutputs;
    try {
      playbackFunction(recording);
    } catch (error) {
      if (!(error instanceof OperationExceptionDuringPlayback)) {
        throw error;
      }
    } finally {
      playbackDuration = Date.now() - start;
      playbackOutputs = this.playbackOutput;
      this.playbackRecording = undefined;
      this.playbackOutput = [];
      this.invokeCounter = {};
    }

    const recordedDuration = recording.getMetadata()[DURATION];
    const recordedOutputs = this.extractRecordedOutput(recording);

    return {
      originalRecording: recording,
      playbackDuration,
      playbackOutputs,
      recordedDuration,
      recordedOutputs,
    };
  }

  private extractRecordedOutput(recording: Recording): Output[] {
    return recording
      .getAllKeys()
      .filter((key) => {
        return key.startsWith("output:") && !key.endsWith("result");
      })
      .map((key): Output => {
        return { key, value: recording.getData(key) };
      });
  }

  private executeOperationFunc(func: Function, args: any[]): any {
    let result: any;
    try {
      result = func(...args);
    } catch (error) {
      if (error instanceof TapeRecorderException) {
        throw error;
      }
      this.recordOutput({
        alias: OPERATION_OUTPUT_ALIAS,
        invocationNumber: 1,
        args: [this.serializableExceptionForm(error)],
      });

      if (this.inPlaybackMode()) {
        throw new OperationExceptionDuringPlayback();
      }

      throw error;
    }

    this.recordOutput({
      alias: OPERATION_OUTPUT_ALIAS,
      invocationNumber: 1,
      args: [result],
    });

    return result;
  }

  recordOutput(params: {
    alias: string;
    invocationNumber: number;
    args: any[];
  }) {
    const interceptionKey =
      this.outputInterceptionKey(params.alias, params.invocationNumber) +
      ".output";

    if (this.inPlaybackMode()) {
      this.playbackOutput.push({ key: interceptionKey, value: params.args });
      return;
    }

    if (this.activeRecording === undefined) {
      return;
    }

    this.recordData(interceptionKey, params.args);
  }

  recordData(key: string, data: any) {
    this.assertRecording();
    console.log(
      `Recording data for recording id ${
        this.activeRecording!.id
      } under key ${key}`
    );
    this.activeRecording!.setData(key, data);
  }

  assertRecording() {
    assert(this.activeRecording !== undefined, "No active recording");
  }

  outputInterceptionKey(alias: any, invocationNumber: any): string {
    return `output: ${alias} #${invocationNumber}`;
  }

  serializableExceptionForm(error: Error | string) {
    return JSON.stringify(error);
  }

  public wrapOperation(category: string, func: Function): Function {
    const that = this;
    function wrappedFunc(...args: any[]) {
      if (that.inPlaybackMode()) {
        return that.executeOperationFunc(func, args);
      } else if (!that.recordingEnabled) {
        return func(...args);
      }

      return that.executeWithRecording({ category, metadata: {}, func, args });
    }

    return wrappedFunc;
  }

  executeWithRecording(params: {
    category: string;
    metadata: MetaData;
    func: Function;
    args: any[];
  }) {
    assert(!this.activeRecording, "Recording already active");

    this.activeRecording = this.tapeCassette.createNewRecording(
      params.category
    );
    console.info(
      `Starting recording for category ${params.category} with id ${this.activeRecording.id}`
    );
    const startTime = Date.now();

    try {
      const result = this.executeOperationFunc(params.func, params.args);
      params.metadata[EXCEPTION_IN_OPERATION] = false;
      return result;
    } catch (error) {
      params.metadata[EXCEPTION_IN_OPERATION] = true;
      throw error;
    } finally {
      if (this.assertRecording === undefined) {
        return;
      }
      const duration = Date.now() - startTime;
      const recording = this.activeRecording;
      this.resetActiveRecording();
      this.addPostOperationMetadata(recording, params.metadata, duration);

      try {
        this.tapeCassette.saveRecording(recording);
        // TODO: make a pretty print of the duration
        console.info(
          `Finished recording of category ${params.category} with id ${recording.id}, recording duration ${duration}`
        );
      } catch (error) {
        console.error(
          `Failed saving recording of category ${params.category} with id ${recording.id} error=${error}`
        );
      }
    }
  }

  addPostOperationMetadata(
    recording: Recording,
    metadata: MetaData,
    duration: number
  ) {
    metadata[RECORDED_AT] = new Date().toUTCString();
    metadata[DURATION] = duration;
    recording.addMetadata(metadata);
  }

  resetActiveRecording() {
    this.activeRecording = undefined;
    this.invokeCounter = {};
  }

  inPlaybackMode() {
    return this.playbackRecording !== undefined;
  }
}
