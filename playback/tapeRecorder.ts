import assert from "assert";
import {
  generatePlaybackException,
  PlaybackExceptionTypes,
} from "./exceptions";
import { Recording } from "./recordings/recording";
import { TapeCassette } from "./tapeCassette";
import { AllowUnwrap, MetaData, Output, Playback } from "./types";

export const OPERATION_INPUT_ALIAS = `_tape_recorder_operation_input`;
export const OPERATION_OUTPUT_ALIAS = `_tape_recorder_operation_output`;
export const DURATION = "_tape_recorder_recording_duration";
export const RECORDED_AT = "_tape_recorder_recorded_at";
export const EXCEPTION_IN_OPERATION = "_tape_recorder_exception_in_operation";

enum RecordingDataType {
  Data = "data",
  Exception = "exception",
}

type RecordedValue = {
  type: RecordingDataType.Data;
  isPromise?: boolean;
  value: any;
};

type RecordedException = {
  type: RecordingDataType.Exception;
  isPromise?: boolean;
  isError?: boolean;
  exception: any;
};
type RecordedData = RecordedValue | RecordedException;

export function extractData(data: RecordedData): any {
  if (data.type === RecordingDataType.Data) {
    return data.value;
  } else {
    return data.exception;
  }
}

/**
 *  This class is used to "record" operation and "replay" (rerun) recorded operation on any code version.
 *  The recording is done by placing different wrappers that intercepts the operation, its inputs and outputs by using
    wrap functions.
 */
export class TapeRecorder {
  tapeCassette?: TapeCassette;
  private playbackRecording?: Recording = undefined;
  private recordingEnabled: boolean = false;
  private playbackOutput: Output[] = [];
  private activeRecording?: Recording = undefined;
  private invokeCounter: Record<string, number> = {};
  private currentlyInInterception: boolean = false;

  /**
   * Initializes the tape recording.
   * @param tapeCassette - the cassette to use for recording.
   */
  constructor(tapeCassette?: TapeCassette) {
    this.tapeCassette = tapeCassette;
  }

  /**
   * Enable recording and interception for all wrapped functions
   */
  enableRecording(): void {
    console.info("Enabling recording");
    this.recordingEnabled = true;
  }

  /**
   * Plays the recorder operation using current code
   * @param recordingId - the id of the recording to play
   * @param playbackFunction - A function that plays back the operation using the recording in the given id
   * @returns
   */
  async play(
    recordingId: string,
    playbackFunction: Function
  ): Promise<Playback> {
    const recording = this.tapeCassette!.getRecording(recordingId);
    assert(recording !== undefined, "Recording not found");
    this.playbackRecording = recording;
    const start = Date.now();

    let playbackDuration;
    let playbackOutputs;
    try {
      await playbackFunction(recording);
    } catch (error) {
      if (!(error.name == "OperationExceptionDuringPlayback")) {
        throw error;
      }
      // This is an exception that was raised by the played back function, should be treated as part of the
      // recording output
    } finally {
      playbackDuration = Date.now() - start;
      playbackOutputs = this.playbackOutput;
      this.playbackRecording = undefined;
      // Clear any previous invocation counter state
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

  /**
   * Generate the outputs for the given recording
   * @param recording - the recording to extract the outputs from
   * @returns the extracted outputs
   */
  private extractRecordedOutput(recording: Recording): Output[] {
    return recording
      .getAllKeys()
      .filter((key) => {
        return key.startsWith("output:") && !key.endsWith("result");
      })
      .map((key): Output => {
        return { key, value: extractData(recording.getData(key)) };
      });
  }

  /**
   * Executes the operation function, records its output and return the result
   * @param func - the function to execute
   * @param args - the arguments to pass to the function
   * @returns the result of the function execution
   */
  private executeOperationFunc(func: Function, args: any[]): any {
    const handleException = (error: any): any => {
      if (error.name == PlaybackExceptionTypes.TapeRecorderException) {
        return error;
      }
      this.recordOutput({
        alias: OPERATION_OUTPUT_ALIAS,
        invocationNumber: 1,
        args: [this.serializableExceptionForm(error)],
      });

      if (this.inPlaybackMode()) {
        // In playback mode we want to capture this as an error that is an output of the function
        //  which is a legit recorded result, and not fail the playback it self
        throw generatePlaybackException(
          PlaybackExceptionTypes.OperationExceptionDuringPlayback
        );
      }

      return error;
    };
    const handleResult = (result: any): any => {
      this.recordOutput({
        alias: OPERATION_OUTPUT_ALIAS,
        invocationNumber: 1,
        args: [result],
      });
    };

    let result: any;
    try {
      result = func(...args);
    } catch (error) {
      throw handleException(error);
    }

    if (result && typeof result.then === "function") {
      result.then(
        (realResult: any) => {
          handleResult(realResult);

          return realResult;
        },
        (err: any) => {
          handleException(err);
        }
      );
    } else {
      // We record the operation result as an output
      handleResult(result);
    }

    return result;
  }

  /**
   * Record the given invocation as output
   * @param params.alias - the alias of the function that was invoked
   * @param params.invocationNumber - Current invocation number for the given alias
   * @param params.args - the input arguments for the invocation
   */
  recordOutput(params: {
    alias: string;
    invocationNumber: number;
    args: any[];
  }): void {
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

    this.recordData(interceptionKey, {
      value: params.args,
      type: RecordingDataType.Data,
    });
  }

  /**
   * Puts current data under given key in the current recording
   * @param key - the key to put the data under
   * @param data - the data to put
   */
  recordData(key: string, data: RecordedData): void {
    this.assertRecording();
    console.log(
      `Recording data for recording id ${
        this.activeRecording!.id
      } under key ${key}`
    );
    this.activeRecording!.setData(key, data);
  }

  /**
   * Assert there is active recording
   * @throws if there is no active recording
   */
  assertRecording(): void {
    assert(this.activeRecording !== undefined, "No active recording");
  }

  /**
   * Creates a key that uniquely represents the output invocation based on alias in invocation count
   * @param alias - the output alias
   * @param invocationNumber - the invocation number
   * @returns the interception key
   */
  outputInterceptionKey(alias: any, invocationNumber: any): string {
    return `output: ${alias} #${invocationNumber}`;
  }

  /**
   * serialize the given exception to a string
   * @param error - the error to serialize
   * @returns the serialized error
   */
  serializableExceptionForm(error: Error | any): string {
    if (error instanceof Error) {
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
    }
    return JSON.stringify(error);
  }

  /**
   * @returns if the tape recorder is currently in recording mode
   */
  inRecordingMode(): boolean {
    return this.recordingEnabled && this.activeRecording !== undefined;
  }

  /**
   * @returns if the tape recorder should intercept input/output
   */
  shouldIntercept(): boolean {
    return (
      !this.currentlyInInterception &&
      (this.inRecordingMode() || this.inPlaybackMode())
    );
  }

  /**
   * Generate the interception key for the given invocation, based on the alias and invocation number
   * @param alias - the invocation alias
   * @param args - the invocation arguments
   * @returns the interception key
   */
  private inputInterceptionKey(alias: string, args: any[]): string {
    return `input: ${alias} args=${JSON.stringify(args)}`;
  }

  /**
   * Disable the current recording
   */
  private discardRecording(): void {
    if (this.activeRecording) {
      console.info(
        `Recording with id ${this.activeRecording.id} was discarded`
      );
      this.tapeCassette!.abortRecording(this.activeRecording);
      this.resetActiveRecording();
    }
  }

  /**
   * Playback the recorded data (value or exception) under the given interception key
   * @param interceptionKey - the interception key to playback
   * @param args - the arguments to pass to the function
   * @returns Recorded intercepted value
   */
  private playbackRecordedInterception(
    interceptionKey: string,
    args: any[]
  ): any {
    const recorded = this.playbackRecording!.getData(
      interceptionKey
    ) as RecordedData;

    if (recorded.type == RecordingDataType.Exception) {
      let error;
      // if the recorded value is an exception, we need to throw it
      // but if the exception was of type Error we need to serialize it and recreate it as a class Error.
      // in general the playback framework do not support Class errors beside the Error class.
      // this is because we cannot recreate the class object as the user create it.
      if (recorded.isError) {
        const errorData = JSON.parse(recorded.exception);
        Object.setPrototypeOf(errorData, Error.prototype);
        error = errorData;
      } else {
        error = recorded.exception;
      }

      if (recorded.isPromise) {
        return Promise.reject(error);
      } else {
        throw error;
      }
    } else if (recorded.type == RecordingDataType.Data) {
      if (recorded.isPromise) {
        return Promise.resolve(recorded.value);
      } else {
        return recorded.value;
      }
    }

    throw `Recorded data has invalid type ${(recorded as any).type}`;
  }

  /**
   * generate interception that do not do anything in playback mode.
   * used for intercepting functions that should not be recorded .
   * in playback mode, this function return playbackValue or an empty object
   * @param func - the function to intercept
   * @param playbackValue - the value to return in playback mode
   * @returns the intercepted function
   */
  public muteInterception<inputType extends Array<any>, outputType>(
    func: (...args: inputType) => outputType,
    playbackValue?: AllowUnwrap<outputType>
  ): (...args: inputType) => outputType {
    const that = this;
    function wrappedFunc(...args: inputType): outputType {
      if (that.inPlaybackMode()) {
        return (playbackValue ?? {}) as outputType;
      } else {
        return func(...args);
      }
    }
    return wrappedFunc;
  }

  /**
   * wrap a function that that acts as an input to the operation, the result of the function is the
   *  recorded input and the passed arguments and function name (or alias) or used as key for the input
   * @param params.alias - the alias of the function that was invoked
   * @param params.func - the function to intercept
   * @param params.interceptionKeyArgsExtractor - a function that extract the arguments for the interception key
   * @default params.interceptionKeyArgsExtractor = (args) => args
   * @returns the intercepted function
   */
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
      //#region generate interceptionKey
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
            PlaybackExceptionTypes.InputInterceptionKeyCreationError,
            errorMessage
          );
        }

        console.error(errorMessage);

        interceptionKey = undefined;
        that.discardRecording();
      }
      //#endregion

      if (that.inPlaybackMode()) {
        return that.playbackRecordedInterception(
          interceptionKey as string,
          args
        );
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

  /**
   * Wrap a function that that acts as an output of the operation, the arguments are recorded as the output and
   *    the result of the function is captured.
   * output and the result of the function is captured
   * @param params.alias - the alias of the function that was invoked
   * @param params.func - the function to intercept
   * @returns the intercepted function
   */
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
        return that.playbackRecordedInterception(interceptionKey, args);
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

  /**
   * Wrap an operation (entry point) so it could be recorded and played back.
   * in recording flow the function will be executed and the result is recorded
   * and in playback mode the function run with the recorded input and output.
   * @param category - the category of the operation
   * @param func - the function to wrap
   * @returns the wrapped function
   */
  public wrapOperation<inputType extends Array<any>, outputType>(
    category: string,
    func: (...args: inputType) => outputType,
    metadata: MetaData = {}
  ): (...args: inputType) => outputType {
    const that = this;
    function wrappedFunc(...args: inputType): outputType {
      if (that.inPlaybackMode()) {
        return that.executeOperationFunc(func, args);
      } else if (!that.recordingEnabled) {
        return func(...args);
      }

      return that.executeWithRecording({ category, metadata, func, args });
    }

    return wrappedFunc;
  }

  /**
   * execute the function and record the result of the function.
   * the new recording is create and store in the recorder tape cassette
   * @param category - the category of the function
   * @param params.func - the function to execute
   * @param params.args - the arguments for the function
   * @param params.metadata - the operation metadata (could be changed during the function run)
   * @returns the result of the function
   */
  executeWithRecording<inputType extends Array<any>, outputType>(params: {
    category: string;
    metadata: MetaData;
    func: (...args: inputType) => outputType;
    args: any[];
  }): outputType {
    assert(!this.activeRecording, "Recording already active");

    const cleanup = () => {
      if (this.activeRecording !== undefined) {
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
    };

    const handleResult = (result: outputType) => {
      params.metadata[EXCEPTION_IN_OPERATION] = false;
      cleanup();
      return result;
    };
    const handleException = (error: any) => {
      params.metadata[EXCEPTION_IN_OPERATION] = true;
      cleanup();
      return error;
    };

    this.activeRecording = this.tapeCassette!.createNewRecording(
      params.category
    );
    console.info(
      `Starting recording for category ${params.category} with id ${this.activeRecording.id}`
    );
    const startTime = Date.now();

    let result;
    try {
      this.recordData(`input: ${OPERATION_INPUT_ALIAS}`, {
        value: params.args,
        type: RecordingDataType.Data,
      });
      result = this.executeOperationFunc(params.func, params.args);
    } catch (error) {
      throw handleException(error);
    }

    if (result && typeof result.then === "function") {
      result.then(
        (realResult: any) => {
          handleResult(realResult);
          return realResult;
        },
        (err: any) => {
          handleException(err);
        }
      );
    } else {
      return handleResult(result);
    }

    return result;
  }

  /**
   * Add metadata to the recording after the operation has been executed
   * @param recording - the recording to add the metadata to
   * @param metadata - the metadata to add, will be added the duration and dates
   * @param duration - the duration of the operation
   */
  addPostOperationMetadata(
    recording: Recording,
    metadata: MetaData,
    duration: number
  ): void {
    metadata[RECORDED_AT] = new Date().toUTCString();
    metadata[DURATION] = duration;
    recording.addMetadata(metadata);
  }

  /**
   * reset the active recording and invoke counter
   */
  resetActiveRecording(): void {
    this.activeRecording = undefined;
    this.invokeCounter = {};
  }

  /**
   * @returns if the tape recorder is in playback mode
   */
  inPlaybackMode(): boolean {
    return this.playbackRecording !== undefined;
  }

  /**
   * Executes the given function and record the result/exception of the outcome
   * @param func - the function to execute
   * @param args - the arguments for the function
   * @param interceptionKey - the key to store the result/exception in the tape cassette
   * @returns the result of the function
   */
  executeFuncAndRecordInterception<inputType extends Array<any>, outputType>(
    func: (...args: inputType) => outputType,
    args: inputType,
    interceptionKey?: string
  ): outputType {
    this.currentlyInInterception = true;
    let result: any;

    const cleanup = () => {
      this.currentlyInInterception = false;
    };
    const handleResult = (
      result: outputType,
      isPromise: boolean
    ): outputType => {
      if (interceptionKey) {
        this.recordData(interceptionKey, {
          value: result,
          isPromise,
          type: RecordingDataType.Data,
        });
      }
      cleanup();
      return result;
    };

    const handleException = (error: any, isPromise: boolean) => {
      if (interceptionKey) {
        // Error object is not easily serializable so we did some workaround to store it
        if (error instanceof Error) {
          this.recordData(interceptionKey, {
            isError: true,
            exception: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            isPromise,
            type: RecordingDataType.Exception,
          });
        } else {
          this.recordData(interceptionKey, {
            exception: error,
            isPromise,
            type: RecordingDataType.Exception,
          });
        }
      }
      cleanup();
      return error;
    };

    try {
      result = func(...args);
    } catch (error) {
      throw handleException(error, false);
    }

    if (result && typeof result.then === "function") {
      result.then(
        (realResult: any) => {
          return handleResult(realResult, true);
        },
        (err: any) => {
          handleException(err, true);
        }
      );
    } else {
      return handleResult(result, false);
    }

    return result;
  }

  /**
   * use the interceptInput as decorator 
   * @returns PropertyDescriptor
   */
  public decoratorInterceptInput() {
    return this.decoratorHandler('input');
  }

  /**
   * use the interceptOutput as decorator 
   * @returns PropertyDescriptor
   */
  public decoratorInterceptOutput() {
    return this.decoratorHandler('output');
  }

  /**
   * @param decoratorType - input | output
   * @returns PropertyDescriptor
   */
  private decoratorHandler(decoratorType: 'input' | 'output') {
    const self = this;
    return (target: Object, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      descriptor.value = function(...args: any[]) {
        const interceptorHandler = decoratorType === 'output' ? self.interceptOutput : self.interceptInput;
        const interceptorFunc = interceptorHandler.call(self, {
          alias: `${this.constructor.name}/${originalMethod.name}`,
          func:  originalMethod.bind(this),
        });
        return interceptorFunc.apply(this, [...args]);
      }
      return descriptor;
    }
  }
}
