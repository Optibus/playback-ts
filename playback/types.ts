import { Recording } from "playback";

export type Output = { key: string; value: any };
export type MetaData = Record<string, any>;

export type Playback = {
  playbackOutputs: Output[];
  playbackDuration: number;
  recordedOutputs: Output[];
  recordedDuration: number;
  originalRecording: Recording;
};
