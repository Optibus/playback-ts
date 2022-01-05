export enum PlaybackExceptionTypes {
  OperationExceptionDuringPlayback = "OperationExceptionDuringPlayback",
  TapeRecorderException = "TapeRecorderException",
  RecordingKeyError = "RecordingKeyError",
  InputInterceptionKeyCreationError = "InputInterceptionKeyCreationError",
}

/**
 * Generate an Error object with the given message and type
 * @param type - the type of the exception (from PlaybackExceptionTypes)
 * @param msg - the exception message
 * @default msg - empty message
 * @returns The error object
 */
export function generatePlaybackException(
  type: PlaybackExceptionTypes,
  msg = ""
): Error {
  const error = new Error(msg);
  error.name = type;
  return error;
}
