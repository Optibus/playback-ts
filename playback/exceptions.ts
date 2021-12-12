export class OperationExceptionDuringPlayback extends Error {
  constructor(m = "") {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, OperationExceptionDuringPlayback.prototype);
  }
}

export class TapeRecorderException extends Error {
  constructor(m = "") {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, TapeRecorderException.prototype);
  }
}

export class RecordingKeyError extends Error {
  constructor(m = "") {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, RecordingKeyError.prototype);
  }
}
