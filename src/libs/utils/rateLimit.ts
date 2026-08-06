import Errors, { HttpCode, Message } from "../Errors";

/**
 * In-memory attempt limiter for the admin login form.
 *
 * Deliberately process-local: it protects a single-instance panel without
 * pulling in Redis. Running several instances behind a load balancer would need
 * a shared store instead.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface Attempt {
    count: number;
    firstAt: number;
}

const attempts = new Map<string, Attempt>();

const prune = (now: number): void => {
    attempts.forEach((attempt, key) => {
        if (now - attempt.firstAt > WINDOW_MS) attempts.delete(key);
    });
};

/** throws once the caller has burnt through its attempts inside the window */
export const assertLoginAllowed = (key: string): void => {
    const now = Date.now();
    prune(now);

    const attempt = attempts.get(key);
    if (attempt && attempt.count >= MAX_ATTEMPTS)
        throw new Errors(
            HttpCode.TOO_MANY_REQUESTS,
            Message.TOO_MANY_ATTEMPTS
        );
};

export const recordLoginFailure = (key: string): void => {
    const now = Date.now(),
        attempt = attempts.get(key);

    if (!attempt || now - attempt.firstAt > WINDOW_MS)
        attempts.set(key, { count: 1, firstAt: now });
    else attempt.count += 1;
};

export const clearLoginFailures = (key: string): void => {
    attempts.delete(key);
};
