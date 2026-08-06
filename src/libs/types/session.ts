import "express-session";

/**
 * Session augmentation for the SSR surface.
 * Retype `member` to the Member interface once the Member entity exists.
 */
declare module "express-session" {
    interface SessionData {
        member?: any;
        csrfToken?: string;
    }
}
