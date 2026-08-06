import crypto from "crypto";
import { Handler } from "../types/common";
import { Message } from "../Errors";

/**
 * CSRF protection for the session-authenticated admin forms.
 *
 * A per-session token is minted on the first admin page view and echoed back in
 * a hidden `_csrf` field. A cross-site form post carries the session cookie but
 * cannot read the token, so it fails the comparison.
 *
 * On multipart routes this must be mounted AFTER the uploader, because the file
 * fields are what populate req.body.
 */
export const issueCsrfToken: Handler = (req, res, next) => {
    if (!req.session.csrfToken)
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    res.locals.csrfToken = req.session.csrfToken;
    next();
};

export const verifyCsrf: Handler = (req, res, next) => {
    const expected = req.session?.csrfToken,
        received = req.body?._csrf;

    if (
        typeof expected === "string" &&
        typeof received === "string" &&
        expected.length === received.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))
    ) {
        next();
    } else {
        console.log("Error, verifyCsrf: token mismatch");
        res.render("error", {
            message: Message.INVALID_CSRF,
            redirect: "/admin",
        });
    }
};
