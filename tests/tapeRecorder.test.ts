import { InMemoryTapeCassette, Playback } from "../playback/";
import { OPERATION_OUTPUT_ALIAS, TapeRecorder } from "../playback/tapeRecorder";

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
    ).value[0];

    if (typeof result === "object" && result !== null) {
      expect(recordedResult).toMatchObject(result);
    } else {
      expect(recordedResult).toEqual(result);
    }
  }

  test("record and playback basic operation no parameters simple value", () => {
    function operation() {
      return 5;
    }

    const wrapOperation = tapeRecorder.wrapOperation("operation", operation);
    const result = wrapOperation();

    expect(result).toBe(5);
    const recordingId = tapeCassette.getLastRecordingId();
    expect(recordingId).toBeDefined();
    const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
    assertPlaybackVsRecording(playbackResult, result);
  });

  test("record and playback basic operation no parameters return an object", () => {
    function operation() {
      return { num: 5 };
    }

    const wrapOperation = tapeRecorder.wrapOperation("operation", operation);
    const result = wrapOperation();

    expect(result).toMatchObject({ num: 5 });
    const recordingId = tapeCassette.getLastRecordingId();
    expect(recordingId).toBeDefined();
    const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
    assertPlaybackVsRecording(playbackResult, result);
  });

  test.only("test record and playback basic operation data interception with arguments", () => {
    let seed = 1;
    function _getValue(a: number, b = 2): number {
      return (a + b) * seed;
    }

    const getValue = tapeRecorder.interceptInput("getValue", _getValue);
    function operation() {
      const val1 = getValue(2, 3);
      const val2 = getValue(4, 6);
      return val1 + val2;
    }

    const wrapOperation = tapeRecorder.wrapOperation("operation", operation);
    const result = wrapOperation();
    expect(result).toBe(15);
    seed = 2;
    const recordingId = tapeCassette.getLastRecordingId();
    expect(recordingId).toBeDefined();
    const playbackResult = tapeRecorder.play(recordingId, wrapOperation);
    assertPlaybackVsRecording(playbackResult, result);
  });
});
