export enum PlaybackExceptionTypes {
  OperationExceptionDuringPlayback = "OperationExceptionDuringPlayback",
  TapeRecorderException = "TapeRecorderException",
  RecordingKeyError = "RecordingKeyError",
  InputInterceptionKeyCreationError = "InputInterceptionKeyCreationError",
}

export function generatePlaybackException(
  msg: string,
  type: PlaybackExceptionTypes
): Error {
  const error = new Error(msg);
  error.name = type;
  return error;
}
