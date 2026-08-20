export type ErrorResult = Readonly<{
  err: unknown;
  msg: string;
}>;

export type Result<T> = Readonly<{
  data?: T;
  error?: ErrorResult;
}>;

export function ok<T>(data: T): Result<T> {
  return { data };
}

export function fail<T>(msg: string, err: unknown = undefined): Result<T> {
  return { error: { err, msg } };
}
