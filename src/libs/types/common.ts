import { NextFunction, Request, Response } from "express";

export interface T {
    [key: string]: any;
}

/**
 * Typed handler shape for controller objects.
 * Each handler still annotates its own request type (ExtendedRequest /
 * AdminRequest); this keeps the object-literal controller shape without
 * dropping type checking at the router.
 */
export type Handler = (
    req: any,
    res: Response,
    next: NextFunction
) => Promise<void> | void;

export type Controller = Record<string, Handler>;

/** what the paginated admin list screens receive */
export interface Paginated<D> {
    list: D[];
    total: number;
    page: number;
    limit: number;
}

export type { Request, Response, NextFunction };
