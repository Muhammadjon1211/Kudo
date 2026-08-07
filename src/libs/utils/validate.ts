import Errors, { HttpCode, Message } from "../Errors";

/**
 * Controller-boundary validation. Every helper throws a domain Errors instance,
 * so the caller's standard catch block reports it like any other failure.
 */

export const requireBody = (body: any): void => {
    if (!body || typeof body !== "object" || Object.keys(body).length === 0)
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
};

export const requireFields = (source: any, fields: string[]): void => {
    requireBody(source);
    const missing = fields.filter(
        (field) =>
            source[field] === undefined ||
            source[field] === null ||
            String(source[field]).trim() === ""
    );
    if (missing.length)
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
};

/** Rejects NaN / negative / absurd values before they reach $skip and $limit. */
export const parsePage = (value: any, fallback = 1): number => {
    const page = Number(value ?? fallback);
    if (!Number.isInteger(page) || page < 1)
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    return page;
};

export const parseLimit = (value: any, fallback = 10, max = 100): number => {
    const limit = Number(value ?? fallback);
    if (!Number.isInteger(limit) || limit < 1 || limit > max)
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    return limit;
};

export const parseNumber = (value: any, { min = 0 } = {}): number => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < min)
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    return num;
};

/** A tally that only makes sense as a whole number: medals, stock, and such. */
export const parseCount = (
    value: any,
    { optional = false } = {}
): number | undefined => {
    if (value === undefined || value === "") {
        if (optional) return undefined;
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    }
    const count = parseNumber(value);
    if (!Number.isInteger(count))
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    return count;
};

/** Narrows an untrusted string to a member of the given TS enum. */
export const parseEnum = <E extends Record<string, string>>(
    value: any,
    enumeration: E,
    { optional = false } = {}
): E[keyof E] | undefined => {
    if (value === undefined || value === "") {
        if (optional) return undefined;
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    }
    if (!Object.values(enumeration).includes(value as string))
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    return value as E[keyof E];
};

export const parseObjectIdString = (value: any): string => {
    if (typeof value !== "string" || !/^[0-9a-fA-F]{24}$/.test(value))
        throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);
    return value;
};

/** Normalises a multer path for storage: backslashes to forward slashes. */
export const normalizePath = (filePath: string): string =>
    filePath.replace(/\\/g, "/");
