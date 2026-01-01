import type { NextFunction, Request, Response } from "express";

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Compose multiple middleware/functions.
 * Useful for combining authentication with async handlers.
 */
export function compose(...fns: Array<(req: Request, res: Response, next: NextFunction) => void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    let i = 0;
    const dispatch = (err?: unknown) => {
      if (err || i >= fns.length) return next(err);
      const fn = fns[i++];
      if (fn) {
        fn(req, res, dispatch);
      }
    };
    dispatch();
  };
}
