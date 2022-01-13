import { Recording } from "./recordings";

export type AllowUnwrap<T> = T extends PromiseLike<infer U> ? U | T : T;

export type Output = { key: string; value: any };
export type MetaData = Record<string, any>;

export type Playback = {
  playbackOutputs: Output[];
  playbackDuration: number;
  recordedOutputs: Output[];
  recordedDuration: number;
  originalRecording: Recording;
};
