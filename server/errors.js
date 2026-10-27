// An error with an HTTP status, a stable code for the UI, and a Thai message shown to the user as is.
export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
