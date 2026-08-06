import mongoose from "mongoose";
import { CookieOptions } from "express";

export const MORGAN_FORMAT = ":method :url :response-time[:status] \n";

/** hours; used for both the JWT expiry and the auth cookie maxAge */
export const AUTH_TIMER = 24;

/** the JWT stays out of reach of page scripts */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
    maxAge: AUTH_TIMER * 3600 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
};

export const shapeIntoMongooseObjectId = (target: any) => {
    return typeof target === "string"
        ? new mongoose.Types.ObjectId(target)
        : target;
};
