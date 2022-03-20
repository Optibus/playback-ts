import { InMemoryTapeCassette, Playback } from "../playback/";
import { PlaybackExceptionTypes } from "../playback/exceptions";
import {
  extractData,
  OPERATION_INPUT_ALIAS,
  OPERATION_OUTPUT_ALIAS,
  TapeRecorder
} from "../playback/tapeRecorder";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("tape recorder", () => {
  jest.setTimeout(30000);
  let tapeRecorder: TapeRecorder;
  let tapeCassette: InMemoryTapeCassette;

  beforeEach(() => {
    tapeCassette = new InMemoryTapeCassette();
    tapeRecorder = new TapeRecorder(tapeCassette);
    tapeRecorder.enableRecording();
  });

  function assertPlaybackVsRecording(playbackResult: Playback, result: any) {
    expect(playbackResult.recordedOutputs).toMatchObject(
      playbackResult.playbackOutputs
    );
    // expect(playbackResult.playbackDuration).toBeGreaterThan(0);
    // expect(playbackResult.recordedDuration).toBeGreaterThan(0);

    const recordedResult = playbackResult.playbackOutputs.find((output) =>
      output.key.includes(OPERATION_OUTPUT_ALIAS)
    )!.value[0];

    if (typeof result === "object" && result !== null) {
      expect(recordedResult).toMatchObject(result);
    } else {
      expect(recordedResult).toEqual(result);
    }
  }

  describe("basic operation", () => {
    describe("static interception", () => {
      describe("no interception ", () => {
        test("record and playback basic operation no parameters simple value", async () => {
          function operation() {
            return 5;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();

          expect(result).toBe(5);
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("record and playback basic operation no parameters return an object", async () => {
          function operation() {
            return { num: 5 };
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();

          expect(result).toMatchObject({ num: 5 });
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("record and playback basic operation with parameters return an object", async () => {
          function operation(params: { a: number; b: string }, a: number) {
            return { num: 5 };
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation({ a: 3, b: "asd" }, 4);

          expect(result).toMatchObject({ num: 5 });
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          const key = playbackResult.originalRecording
            .getAllKeys()
            .find((key) => key.includes(OPERATION_INPUT_ALIAS));
          expect(key).toBeDefined();
          expect(
            extractData(playbackResult.originalRecording.getData(key as string))
          ).toMatchObject([{ a: 3, b: "asd" }, 4]);
        });

        test("test record and playback basic operation data - async", async () => {
          let seed = 1;

          async function operation() {
            await delay(1000);
            return 15 * seed;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = await wrapOperation();
          expect(result).toBe(15);
          seed = 2;
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          const key = playbackResult.originalRecording
            .getAllKeys()
            .find((key) => key.includes(OPERATION_OUTPUT_ALIAS));
          expect(key).toBeDefined();
          expect(
            extractData(playbackResult.originalRecording.getData(key as string))
          ).toMatchObject([15]);
        });
      });

      describe("with input interception", () => {
        test("test record and playback basic operation data interception with arguments", async () => {
          let seed = 1;
          function _getValue(a: number, b = 2): number {
            return (a + b) * seed;
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          function operation() {
            const val1 = getValue(2, 3);
            const val2 = getValue(4, 6);
            return val1 + val2;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();
          expect(result).toBe(15);
          seed = 2;
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with string exception", async () => {
          function _getValue(a: number, b = 2): number {
            throw `${a + b}`;
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          function operation() {
            try {
              getValue(2, 3);
            } catch (error) {
              return error;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toBe("5");

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with object exception", async () => {
          function _getValue(a: number, b = 2): number {
            throw { sum: a + b };
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          function operation() {
            try {
              getValue(2, 3);
            } catch (error) {
              return error;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toMatchObject({ sum: 5 });

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with Error exception", async () => {
          function _getValue(a: number, b = 2): number {
            throw new Error(`sum = ${a + b}`);
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          function operation() {
            try {
              getValue(2, 3);
            } catch (error) {
              return error.message;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toBe(`sum = 5`);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation when creating interception key failed during recording", async () => {
          let content: number[] = [];
          function addContent(a: number): number {
            return content.push(a);
          }

          const length = tapeRecorder.interceptInput({
            alias: "getValue",
            func: (): number => {
              return content.length;
            },
            interceptionKeyArgsExtractor: (): string => {
              throw new Error("failed");
            },
          });

          function operation() {
            addContent(2);
            addContent(6);
            const result = length();
            addContent(2);
            addContent(6);
            return result + length();
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();
          expect(result).toBe(6);

          content = [];
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeUndefined();
        });

        test("test record and playback basic operation when creating interception key failed during playback", async () => {
          let content: number[] = [];
          let throwError = false;
          function addContent(a: number): number {
            return content.push(a);
          }

          const length = tapeRecorder.interceptInput({
            alias: "getValue",
            func: (): number => {
              return content.length;
            },
            interceptionKeyArgsExtractor: (): string => {
              if (throwError) {
                throw new Error("failed");
              }
              return content.join("");
            },
          });

          function operation() {
            addContent(2);
            addContent(6);
            const result = length();
            addContent(2);
            addContent(6);
            return result + length();
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();
          expect(result).toBe(6);
          throwError = true;
          content = [];
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          const error = JSON.parse(
            playbackResult.playbackOutputs.find((output) =>
              output.key.includes(OPERATION_OUTPUT_ALIAS)
            )!.value[0]
          );
          expect(error.name).toBe(
            PlaybackExceptionTypes.InputInterceptionKeyCreationError
          );
        });

        test("test interceptionKeyArgsExtractor", async () => {
          let content: number[] = [];
          function addContent(a: number): number {
            return content.push(a);
          }

          const length = tapeRecorder.interceptInput({
            alias: "getValue",
            func: (): number => {
              return content.length;
            },
            interceptionKeyArgsExtractor: (): string => {
              return content.join("");
            },
          });

          function operation() {
            addContent(2);
            addContent(6);
            const result = length();
            addContent(2);
            addContent(6);
            return result + length();
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();
          expect(result).toBe(6);

          content = [];
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with arguments - async", async () => {
          let seed = 1;
          async function _getValue(a: number, b = 2): Promise<number> {
            await delay(1000);
            return (a + b) * seed;
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          async function operation() {
            const val1 = await getValue(2, 3);
            const val2 = await getValue(4, 6);

            return val1 + val2;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = await wrapOperation();
          expect(result).toBe(15);
          seed = 2;
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with arguments - async and promise", async () => {
          let seed = 1;
          async function _getValue(a: number, b = 2): Promise<number> {
            await delay(1000);
            return (a + b) * seed;
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          async function operation() {
            const result =  getValue(2, 3).then(async (val1) => { return await getValue(4, 6).then((val2) => { return val1 + val2; }); });
            return await result;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = await wrapOperation();
          expect(result).toBe(15);
          seed = 2;
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });


        test("test record and playback basic operation data interception with Error exception - async", async () => {
          async function _getValue(a: number, b = 2): Promise<number> {
            await delay(1000);
            throw new Error(`sum = ${a + b}`);
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          async function operation() {
            try {
              await getValue(2, 3);
            } catch (error) {
              return error.message;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = await wrapOperation();
          expect(result).toBe(`sum = 5`);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with Error exception - promise then", async () => {
          async function _getValue(a: number, b = 2): Promise<number> {
            await delay(1000);
            throw new Error(`sum = ${a + b}`);
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          async function operation() {
            const p = getValue(2, 3);
            return p.then(
              (value) => {
                console.log("then");
                return value;
              },
              (error) => {
                console.log("error");
                return error.message;
              }
            );
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = await wrapOperation();
          expect(result).toBe(`sum = 5`);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with Error exception - promise then catch", async () => {
          async function _getValue(a: number, b = 2): Promise<number> {
            await delay(1000);
            throw new Error(`sum = ${a + b}`);
          }

          const getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: _getValue,
          });
          async function operation() {
            const p = getValue(2, 3);
            return p.then(
              (value) => {
                console.log("then");
                return value;
              }).catch((error) => {
                console.log("error");
                return error.message;
              }
            );
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = await wrapOperation();
          expect(result).toBe(`sum = 5`);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation mute interception with arguments", async () => {
          let secret = "secret";

          const getSecret = tapeRecorder.muteInterception(
            (a: number, b = 2): string => {
              return secret;
            }
          );
          function operation() {
            const secret = getSecret(2, 3);
            return secret == "not secret" ? 15 : 10;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();
          expect(result).toBe(10);
          secret = "not secret";
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);

          expect(
            JSON.stringify(playbackResult.originalRecording).includes("secret")
          ).toBeFalsy();
        });

        test("test record and playback basic operation mute interception with default values", async () => {
          let secret = "secret";

          const getSecret = tapeRecorder.muteInterception(
            (a: number, b = 2): string => {
              return secret;
            },
            "123456"
          );
          function operation() {
            const secret = getSecret(2, 3);
            return secret.length == 6 ? 10 : 15;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );
          const result = wrapOperation();
          expect(result).toBe(10);
          secret = "not secret";
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);

          expect(
            JSON.stringify(playbackResult.originalRecording).includes("secret")
          ).toBeFalsy();
        });
      });

      describe("With output interception", () => {
        test("test record and playback basic operation data interception with arguments", async () => {
          const output = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: (value: any, args: any): number => {
              return value;
            },
          });
          function operation() {
            let x = output(4, "a");
            x += output(3, "b");
            return x;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toBe(7);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[1].value).toMatchObject([
            3,
            "b",
          ]);
          expect(playbackResult.playbackOutputs[0].key).not.toBe(
            playbackResult.playbackOutputs[1].key
          );
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
          expect(playbackResult.playbackOutputs[1].key).toContain(
            "output_function"
          );
        });

        test("test record and playback basic operation data interception with arguments async", async () => {
          const output = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: async (value: any, args: any): Promise<number> => {
              await delay(1000);
              return value;
            },
          });
          async function operation() {
            let x = await output(4, "a");
            x += await output(3, "b");
            return x;
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = await wrapOperation();
          expect(result).toBe(7);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[1].value).toMatchObject([
            3,
            "b",
          ]);
          expect(playbackResult.playbackOutputs[0].key).not.toBe(
            playbackResult.playbackOutputs[1].key
          );
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
          expect(playbackResult.playbackOutputs[1].key).toContain(
            "output_function"
          );
        });

        test("test record and playback basic operation data interception with arguments with string exception", async () => {
          const output = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: (value: any, args: any): number => {
              throw `${value}`;
            },
          });
          function operation() {
            try {
              output(4, "a");
            } catch (error) {
              return error;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toBe("4");

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
        });

        test("test record and playback basic operation data interception with arguments with object exception", async () => {
          const output = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: (value: any, args: any): number => {
              throw { value };
            },
          });
          function operation() {
            try {
              output(4, "a");
            } catch (error) {
              return error;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toMatchObject({ value: 4 });

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
        });

        test("test record and playback basic operation data interception with arguments with Error exception", async () => {
          const output = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: (value: any, args: any): number => {
              throw new Error(`value = ${value}`);
            },
          });
          function operation() {
            try {
              output(4, "a");
            } catch (error) {
              return error.message;
            }
          }

          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            operation
          );

          const result = wrapOperation();
          expect(result).toBe("value = 4");

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
        });
      });
    });

    describe("class interception", () => {
      describe("no interception ", () => {
        class TestOperation {
          value: number;
          constructor(value: number) {
            this.value = value;
          }

          public operation() {
            return this.value;
          }

          public arrowOperation = () => {
            return this.value;
          };

          public async operationAsync() {
            await delay(1000);
            return this.value;
          }
        }

        test("record and playback basic operation no parameters simple value", async () => {
          const cls = new TestOperation(5);
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            cls.operation.bind(cls)
          );
          const result = wrapOperation();

          expect(result).toBe(5);
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("record and playback basic operation error function no parameters simple value", async () => {
          const cls = new TestOperation(5);
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            cls.arrowOperation
          );
          const result = wrapOperation();

          expect(result).toBe(5);
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("record and playback basic operation async function no parameters simple value", async () => {
          const cls = new TestOperation(5);
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            cls.operationAsync.bind(cls)
          );
          const result = await wrapOperation();

          expect(result).toBe(5);
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });
      });

      describe("with input interception", () => {
        class TestOperation {
          public seed: number;
          constructor(seed: number) {
            this.seed = seed;
          }

          public getValue(a: number, b = 2): number {
            return (a + b) * this.seed;
          }

          public operation() {
            const val1 = this.getValue(2, 3);
            const val2 = this.getValue(4, 6);
            return val1 + val2;
          }

          public async asyncGetValue(a: number, b = 2): Promise<number> {
            await delay(1000);
            return (a + b) * this.seed;
          }
          public async asyncOperation() {
            await delay(1000);
            const val1 = await this.asyncGetValue(2, 3);
            const val2 = await this.asyncGetValue(4, 6);
            return val1 + val2;
          }
        }

        test("test record and playback basic operation data interception with arguments", async () => {
          const test = new TestOperation(1);

          test.getValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: test.getValue.bind(test),
          });
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            test.operation.bind(test)
          );
          const result = wrapOperation();
          expect(result).toBe(15);
          test.seed = 2;

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });

        test("test record and playback basic operation data interception with arguments - async", async () => {
          const test = new TestOperation(1);

          test.asyncGetValue = tapeRecorder.interceptInput({
            alias: "getValue",
            func: test.asyncGetValue.bind(test),
          });
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            test.asyncOperation.bind(test)
          );

          const result = await wrapOperation();
          expect(result).toBe(15);
          test.seed = 2;
          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }
          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
        });
      });

      describe("With output interception", () => {
        class TestOperation {
          constructor() {}

          public output(value: any, args: any): number {
            return value;
          }

          public operation() {
            let x = this.output(4, "a");
            x += this.output(3, "b");
            return x;
          }

          public async asyncOutput(value: any, args: any): Promise<number> {
            await delay(1000);
            return value;
          }

          public async asyncOperation() {
            let x = await this.asyncOutput(4, "a");
            x += await this.asyncOutput(3, "b");
            return x;
          }
        }
        test("test record and playback basic operation data interception with arguments", async () => {
          const test = new TestOperation();

          test.output = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: test.output.bind(test),
          });
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            test.operation.bind(test)
          );

          const result = wrapOperation();
          expect(result).toBe(7);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[1].value).toMatchObject([
            3,
            "b",
          ]);
          expect(playbackResult.playbackOutputs[0].key).not.toBe(
            playbackResult.playbackOutputs[1].key
          );
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
          expect(playbackResult.playbackOutputs[1].key).toContain(
            "output_function"
          );
        });

        test("test record and playback basic operation data interception with arguments async", async () => {
          const test = new TestOperation();

          test.asyncOutput = tapeRecorder.interceptOutput({
            alias: "output_function",
            func: test.asyncOutput.bind(test),
          });
          const wrapOperation = tapeRecorder.wrapOperation(
            "operation",
            test.asyncOperation.bind(test)
          );

          const result = await wrapOperation();
          expect(result).toBe(7);

          const recordingId = tapeCassette.getLastRecordingId();
          expect(recordingId).toBeDefined();
          if (!recordingId) {
            throw "recordingId must be defined";
          }

          const playbackResult = await tapeRecorder.play(
            recordingId,
            wrapOperation
          );
          assertPlaybackVsRecording(playbackResult, result);
          expect(playbackResult.playbackOutputs[0].value).toMatchObject([
            4,
            "a",
          ]);
          expect(playbackResult.playbackOutputs[1].value).toMatchObject([
            3,
            "b",
          ]);
          expect(playbackResult.playbackOutputs[0].key).not.toBe(
            playbackResult.playbackOutputs[1].key
          );
          expect(playbackResult.playbackOutputs[0].key).toContain(
            "output_function"
          );
          expect(playbackResult.playbackOutputs[1].key).toContain(
            "output_function"
          );
        });
      });
    });

    describe("decorators interceptors", () => {
      class TestService {
        public seed: number;
        constructor(seed: number) {
            this.seed = seed;
        }
        
        decoratorInterceptInput(number1: number, number2: number) {
          const decoratorHandler = tapeRecorder.decoratorInterceptInput();
          const func = () => {
            return number1 + number2 + this.seed;
          }
          const fakeDecorator = decoratorHandler({}, '', {value:func});
          return fakeDecorator.value.apply(this, arguments) as number;
        }
      
        decoratorInterceptOutput(number1: number, number2: number) {
          const decoratorHandler = tapeRecorder.decoratorInterceptOutput();
          const func = async() => {
            await delay(1000);
            return number1 + number2 + this.seed;
          }
          const fakeDecorator = decoratorHandler({}, '', {value:func});
          return fakeDecorator.value.apply(this, arguments) as Promise<number>;
        }
      }

      test("test record and playback basic operation data interception with arguments - async", async() => {
        const testService = new TestService(2);
        async function operation () {
          const val1 = testService.decoratorInterceptInput(2, 3);
          const val2 = await testService.decoratorInterceptOutput(4, 6);
          return val1 + val2;
        }
    
        const wrapOperation = tapeRecorder.wrapOperation(
          "operation",
          operation
        );

        const result = await wrapOperation();
        expect(result).toBe(19);

        testService.seed = 1234;
        const recordingId = tapeCassette.getLastRecordingId();
        expect(recordingId).toBeDefined();
        if (!recordingId) {
          throw "recordingId must be defined";
        }

        const playbackResult = await tapeRecorder.play(
          recordingId,
          wrapOperation
        );
        assertPlaybackVsRecording(playbackResult, result);
      })
    })
  });
});
