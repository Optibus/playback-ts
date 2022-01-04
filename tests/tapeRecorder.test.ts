import { InMemoryTapeCassette, Playback } from "../playback/";
import {
  OPERATION_INPUT_ALIAS,
  OPERATION_OUTPUT_ALIAS,
  TapeRecorder,
} from "../playback/tapeRecorder";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("tape recorder", () => {
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
    describe("no interception ", () => {
      test("record and playback basic operation no parameters simple value", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test("record and playback basic operation no parameters return an object", () => {
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
        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test("record and playback basic operation with parameters return an object", () => {
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
        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
        const key = playbackResult.originalRecording
          .getAllKeys()
          .find((key) => key.includes(OPERATION_INPUT_ALIAS));
        expect(key).toBeDefined();
        expect(
          playbackResult.originalRecording.getData(key as string)
        ).toMatchObject([{ a: 3, b: "asd" }, 4]);
      });
    });

    describe("with input interception", () => {
      test("test record and playback basic operation data interception with arguments", () => {
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
        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test("test record and playback basic operation data interception with string exception", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test("test record and playback basic operation data interception with object exception", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test("test record and playback basic operation data interception with Error exception", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test.skip("test record and playback basic operation when creating interception key failed", () => {
        throw new Error("test");
      });

      test("test interceptionKeyArgsExtractor", () => {
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
        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
      });

      test.only("test record and playback basic operation data interception with arguments - async", async () => {
        let seed = 1;
        async function _getValue(a: number, b = 2): Promise<number> {
          return delay(1000)
            .then(() => {
              return (a + b) * seed;
            })
            .catch((error) => {
              throw error;
            });
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
    });

    describe("With output interception", () => {
      test("test record and playback basic operation data interception with arguments", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
        expect(playbackResult.playbackOutputs[0].value).toMatchObject([4, "a"]);
        expect(playbackResult.playbackOutputs[1].value).toMatchObject([3, "b"]);
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

      test("test record and playback basic operation data interception with arguments with string exception", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
        expect(playbackResult.playbackOutputs[0].value).toMatchObject([4, "a"]);
        expect(playbackResult.playbackOutputs[0].key).toContain(
          "output_function"
        );
      });

      test("test record and playback basic operation data interception with arguments with object exception", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
        expect(playbackResult.playbackOutputs[0].value).toMatchObject([4, "a"]);
        expect(playbackResult.playbackOutputs[0].key).toContain(
          "output_function"
        );
      });

      test("test record and playback basic operation data interception with arguments with Error exception", () => {
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

        const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
        assertPlaybackVsRecording(playbackResult, result);
        expect(playbackResult.playbackOutputs[0].value).toMatchObject([4, "a"]);
        expect(playbackResult.playbackOutputs[0].key).toContain(
          "output_function"
        );
      });
    });
  });
});
