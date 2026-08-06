import express, { NextFunction, Request, Response } from "express";
import path from "path";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";
import ConnectMongoDB from "connect-mongodb-session";
import Errors, { HttpCode, Message } from "./libs/Errors";
import { AUTH_TIMER, MORGAN_FORMAT } from "./libs/config";
import { issueCsrfToken } from "./libs/utils/csrf";
import router from "./router";
import routerAdmin from "./router-admin";
import "./libs/types/session";

const MongoDBStore = ConnectMongoDB(session);
const store = new MongoDBStore({
    uri: String(process.env.MONGO_URL),
    collection: "sessions",
});

/* without a listener the store swallows write failures and logins vanish */
store.on("error", function (err: Error) {
    console.log("Error, session store:", err.message);
});

const app = express();

/* 1-ENTRANCE */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(morgan(MORGAN_FORMAT));

/* 2-SESSIONS */
app.use(
    session({
        secret: String(process.env.SESSION_SECRET),
        cookie: {
            maxAge: AUTH_TIMER * 3600 * 1000,
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
        },
        store: store,
        resave: true,
        saveUninitialized: false,
    })
);

app.use(function (req: Request, res: Response, next: NextFunction) {
    res.locals.member = req.session.member;
    next();
});

/* 3-VIEWS */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/* 4-ROUTES */
app.use("/admin", issueCsrfToken, routerAdmin);
app.use("/", router);

/* 5-BACKSTOPS */
app.use(function (req: Request, res: Response) {
    res.status(HttpCode.NOT_FOUND).json({
        code: HttpCode.NOT_FOUND,
        message: Message.ROUTE_NOT_FOUND,
    });
});

app.use(function (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.log("Error, unhandled:", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
});

export default app;
