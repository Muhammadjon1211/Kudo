import { NextFunction, Request, Response } from "express";
import { Controller } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AUTH_COOKIE_OPTIONS } from "../libs/config";
import MemberService from "../models/Member.service";
import AuthService from "../models/Auth.service";
import {
    ExtendedRequest,
    LoginInput,
    Member,
    MemberInput,
    MemberInquiry,
    MemberUpdateInput,
} from "../libs/types/member";
import {
    normalizePath,
    parseLimit,
    parsePage,
    requireFields,
} from "../libs/utils/validate";

const memberService = new MemberService();
const authService = new AuthService();
const memberController: Controller = {};

memberController.signup = async (req: Request, res: Response) => {
    try {
        console.log("signup");
        requireFields(req.body, [
            "memberNick",
            "memberPhone",
            "memberPassword",
        ]);
        const input: MemberInput = req.body,
            result: Member = await memberService.signup(input),
            token = await authService.createToken(result);

        res.cookie("accessToken", token, AUTH_COOKIE_OPTIONS);
        res.status(HttpCode.CREATED).json({
            member: result,
            accessToken: token,
        });
    } catch (err) {
        console.log("Error, signup", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

memberController.login = async (req: Request, res: Response) => {
    try {
        console.log("login");
        requireFields(req.body, ["memberNick", "memberPassword"]);
        const input: LoginInput = req.body,
            result = await memberService.login(input),
            token = await authService.createToken(result);

        res.cookie("accessToken", token, AUTH_COOKIE_OPTIONS);
        res.status(HttpCode.OK).json({ member: result, accessToken: token });
    } catch (err) {
        console.log("Error, login", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

memberController.logout = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("logout");
        res.cookie("accessToken", "", { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
        res.status(HttpCode.OK).json({ logout: true });
    } catch (err) {
        console.log("Error, logout", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** public: the Top Students board, ranked by medals */
memberController.getTopStudents = async (req: Request, res: Response) => {
    try {
        console.log("getTopStudents");
        const { page, limit } = req.query;
        const inquiry: MemberInquiry = {
            page: parsePage(page),
            limit: parseLimit(limit),
        };

        const result = await memberService.getTopStudents(inquiry);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getTopStudents", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

memberController.getMemberDetail = async (
    req: ExtendedRequest,
    res: Response
) => {
    try {
        console.log("getMemberDetail");
        const result = await memberService.getMemberDetail(req.member);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMemberDetail", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

memberController.updateMember = async (
    req: ExtendedRequest,
    res: Response
) => {
    try {
        console.log("updateMember");
        const input: MemberUpdateInput = req.body;
        if (req.file) input.memberImage = normalizePath(req.file.path);

        const result = await memberService.updateMember(req.member, input);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateMember", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** AUTH GUARDS */

memberController.verifyAuth = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.cookies["accessToken"];
        if (!token)
            throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);

        req.member = await authService.checkAuth(token);
        next();
    } catch (err) {
        console.log("Error, verifyAuth", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** optional auth: a guest browses on, a member gets the extra behaviour */
memberController.retrieveAuth = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.cookies["accessToken"];
        if (token) req.member = await authService.checkAuth(token);
        next();
    } catch (err) {
        console.log("Error, retrieveAuth", err);
        next();
    }
};

export default memberController;
