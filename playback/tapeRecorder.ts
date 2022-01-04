import assert from "assert";
import {
  generatePlaybackException,
  PlaybackExceptionTypes
} from "./exceptions";
import { Recording } from "./recordings/recording";
import { TapeCassette } from "./tapeCassette";
import { MetaData, Output, Playback } from "./types";

export const OPERATION_INPUT_ALIAS = `_tape_recorder_operation_input`;
export const OPERATION_OUTPUT_ALIAS = `_tape_recorder_operation`;
export const DURATION = "_tape_recorder_recording_duration";
export const RECORDED_AT = "_tape_recorder_recorded_at";
export const EXCEPTION_IN_OPERATION = "_tape_recorder_exception_in_operation";

export class TapeRecorder {
  readonly tapeCassette?: TapeCassette;
  private playbackRecording?: Recording = undefined;
  private recordingEnabled: boolean = false;
  private playbackOutput: Output[] = [];
  private activeRecording?: Recording = undefined;
  private invokeCounter: Record<string, number> = {};
  private currentlyInInterception: boolean = false;

  constructor(tapeCassette?: TapeCassette) {
    this.tapeCassette = tapeCassette;
  }

  enableRecording() {
    console.info("Enabling recording");
    this.recordingEnabled = true;
  }

  play(recordingId: string, playbackFunction: Function): Playback {
    const recording = this.tapeCassette!.getRecording(recordingId);
    assert(recording !== undefined, "Recording not found");
    this.playbackRecording = recording;
    const start = Date.now();

    let playbackDuration;
    let playbackOutputs;
    try {
      playbackFunction(recording);
    } catch (error) {
      if (!(error.name = "OperationExceptionDuringPlayback")) {
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
      if (error.name == PlaybackExceptionTypes.TapeRecorderException) {
        throw error;
      }
      this.recordOutput({
        alias: OPERATION_OUTPUT_ALIAS,
        invocationNumber: 1,
        args: [this.serializableExceptionForm(error)],
      });

      if (this.inPlaybackMode()) {
        throw generatePlaybackException(
          "",
          PlaybackExceptionTypes.OperationExceptionDuringPlayback
        );
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

  inRecordingMode(): boolean {
    return this.recordingEnabled && this.activeRecording !== undefined;
  }

  shouldIntercept(): boolean {
    return (
      !this.currentlyInInterception &&
      (this.inRecordingMode() || this.inPlaybackMode())
    );
  }

  private inputInterceptionKey(alias: string, args: any[]): string {
    return `input: ${alias} args=${JSON.stringify(args)}`;
  }

  private discardRecording() {
    if (this.activeRecording) {
      console.info(
        `Recording with id ${this.activeRecording.id} was discarded`
      );
      this.tapeCassette!.abortRecording(this.activeRecording);
      this.resetActiveRecording();
    }
  }

  private playbackRecordedInterception(
    interceptionKey: string,
    args: any[]
  ): any {
    const recorded = this.playbackRecording!.getData(interceptionKey);

    if ("exception" in recorded) {
      if (recorded.isError) {
        const errorData = JSON.parse(recorded.exception);
        Object.setPrototypeOf(errorData, Error.prototype);
        throw errorData;
      } else {
        throw recorded.exception;
      }
    }
    return recorded.value;
  }


  public muteInterception<inputType extends Array<any>, outputType>(
    func: (...args: inputType) => outputType
  ) {
    const that = this;
    function wrappedFunc(...args: inputType) {
      if (that.inPlaybackMode()) {
        return {} as outputType;
      } else {
        return func(...args)
      }
    }
    return wrappedFunc;
  }

  public interceptInput<inputType extends Array<any>, outputType>(params: {
    alias: string;
    func: (...args: inputType) => outputType;
    interceptionKeyArgsExtractor?: (args: inputType) => string;
  }): (...args: inputType) => outputType {
    const that = this;
    function wrappedFunc(...args: inputType) {
      if (!that.shouldIntercept()) {
        return params.func(...args);
      }

      let interceptionKey;
      try {
        interceptionKey = that.inputInterceptionKey(
          params.alias,
          params.interceptionKeyArgsExtractor
            ? [params.interceptionKeyArgsExtractor(args)]
            : args
        );
      } catch (error) {
        const errorMessage = `Input interception key creation error for alias \'${
          params.alias
        }\' - ${JSON.stringify(error)}`;

        if (that.inPlaybackMode()) {
          throw generatePlaybackException(
            errorMessage,
            PlaybackExceptionTypes.InputInterceptionKeyCreationError
          );
        }

        console.error(errorMessage);

        interceptionKey = undefined;
        that.discardRecording();
      }

      if (that.inPlaybackMode()) {
        try {
          return that.playbackRecordedInterception(
            interceptionKey as string,
            args
          );
        } catch (error) {
          if (error.name == PlaybackExceptionTypes.RecordingKeyError) {
            return params.func(...args);
          }
          throw error;
        }
      } else {
        return that.executeFuncAndRecordInterception(
          params.func,
          args,
          interceptionKey
        );
      }
    }

    return wrappedFunc;
  }

  public interceptOutput<inputType extends Array<any>, outputType>(params: {
    alias: string;
    func: (...args: inputType) => outputType;
  }): (...args: inputType) => outputType {
    const that = this;

    function wrappedFunc(...args: inputType) {
      if (!that.shouldIntercept()) {
        return params.func(...args);
      }

      // If same alias(function) is invoked more than once we want to track each output invocation
      that.invokeCounter[params.alias] =
        that.invokeCounter[params.alias] + 1 || 1;
      const invocationNumber = that.invokeCounter[params.alias] as number;

      // Both in recording and playback mode we record what is sent to the output
      that.recordOutput({ alias: params.alias, invocationNumber, args });

      // Record output may have failed and discarded current recording which would make should intercept false
      if (!that.shouldIntercept) {
        return params.func(...args);
      }

      const interceptionKey =
        that.outputInterceptionKey(params.alias, invocationNumber) + ".result";

      if (that.inPlaybackMode()) {
        // Return recording of input invocation
        try {
          return that.playbackRecordedInterception(interceptionKey, args);
        } catch (error) {
          throw error;
        }
      } else {
        // Record the output result so it can be returned in playback mode
        return that.executeFuncAndRecordInterception(
          params.func,
          args,
          interceptionKey
        );
      }
    }

    return wrappedFunc;
  }

  public wrapOperation<inputType extends Array<any>, outputType>(
    category: string,
    func: (...args: inputType) => outputType
  ): (...args: inputType) => outputType {
    const that = this;
    function wrappedFunc(...args: inputType): outputType {
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

    this.activeRecording = this.tapeCassette!.createNewRecording(
      params.category
    );
    console.info(
      `Starting recording for category ${params.category} with id ${this.activeRecording.id}`
    );
    const startTime = Date.now();

    try {
      this.recordData(`input: ${OPERATION_INPUT_ALIAS}`, params.args)
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
        this.tapeCassette!.saveRecording(recording);
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

  executeFuncAndRecordInterception<inputType extends Array<any>, outputType>(
    func: (...args: inputType) => outputType,
    args: inputType,
    interceptionKey?: string
  ): outputType {
    this.currentlyInInterception = true;
    let result: outputType;
    try {
      result = func(...args);
    } catch (error) {
      if (interceptionKey) {
        if (error instanceof Error) {
          this.recordData(interceptionKey, {
            isError: true,
            exception: JSON.stringify(error, Object.getOwnPropertyNames(error)),
          });
        } else {
          this.recordData(interceptionKey, { exception: error });
        }
      }
      throw error;
    } finally {
      this.currentlyInInterception = false;
    }

    if (interceptionKey) {
      this.recordData(interceptionKey, { value: result });
    }
    return result;
  }
}
