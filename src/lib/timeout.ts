export class TimeoutError extends Error {
  constructor(label = "operation") {
    super(`${label} timed out`);
    this.name = "TimeoutError";
  }
}

/** Reject with a TimeoutError if `p` doesn't settle within `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
