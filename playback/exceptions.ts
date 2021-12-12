
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
export class InputInterceptionKeyCreationError extends Error {
  constructor(m = "") {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, RecordingKeyError.prototype);
  }
}

export class InterceptedError extends Error {
  readonly instanceType: string;
  constructor(error: Error, instanceType: string) {
    super(error.message);
    this.name = error.name;
    this.stack = error.stack;
    this.instanceType = instanceType;

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InterceptedError.prototype);
  }

  instanceof(error: Class): boolean {
    return typeof error === this.instanceType;
}
