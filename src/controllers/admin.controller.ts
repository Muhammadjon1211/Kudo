import { NextFunction, Request, Response } from "express";
import { Controller } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import MemberService from "../models/Member.service";
import ProductService from "../models/Product.service";
import BlogService from "../models/Blog.service";
import OrderService from "../models/Order.service";
import { MemberStatus, MemberType } from "../libs/enums/member.enum";
import { OrderStatus } from "../libs/enums/order.enum";
import {
    AdminRequest,
    LoginInput,
    MemberInput,
    MemberInquiry,
    MemberUpdateInput,
    PasswordChangeInput,
} from "../libs/types/member";
import {
    parseEnum,
    parseLimit,
    parseObjectIdString,
    parsePage,
    requireFields,
} from "../libs/utils/validate";
import { toPlainJSON } from "../libs/utils/serialize";
import { toQueryString } from "../libs/utils/query";
import {
    assertLoginAllowed,
    clearLoginFailures,
    recordLoginFailure,
} from "../libs/utils/rateLimit";

const memberService = new MemberService();
const productService = new ProductService();
const blogService = new BlogService();
const orderService = new OrderService();
const adminController: Controller = {};

const PAGE_SIZE = 20;

/** PAGES */

adminController.goHome = async (req: AdminRequest, res: Response) => {
    try {
        console.log("goHome");
        if (!req.session?.member) {
            res.render("home", { stats: null });
            return;
        }

        const [members, products, blogs, orders, pending] = await Promise.all([
            memberService.countMembers(),
            productService.countProducts(),
            blogService.countBlogs(),
            orderService.countOrders(),
            orderService.countOrders(OrderStatus.PAUSE),
        ]);

        res.render("home", {
            stats: { members, products, blogs, orders, pending },
        });
    } catch (err) {
        console.log("Error, goHome", err);
        res.render("home", { stats: null });
    }
};

adminController.getLogin = async (req: Request, res: Response) => {
    try {
        console.log("getLogin");
        res.render("login");
    } catch (err) {
        console.log("Error, getLogin", err);
        res.redirect("/admin");
    }
};

adminController.getSignup = async (req: Request, res: Response) => {
    try {
        console.log("getSignup");
        res.render("signup");
    } catch (err) {
        console.log("Error, getSignup", err);
        res.redirect("/admin");
    }
};

/** AUTH */

adminController.processSignup = async (req: AdminRequest, res: Response) => {
    try {
        console.log("processSignup");
        requireFields(req.body, [
            "memberNick",
            "memberPhone",
            "memberPassword",
        ]);
        const input: MemberInput = req.body;
        const result = await memberService.processSignup(input);

        req.session.member = toPlainJSON(result);
        req.session.save(function () {
            res.redirect("/admin/product/all");
        });
    } catch (err) {
        console.log("Error, processSignup", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/signup" });
    }
};

adminController.processLogin = async (req: AdminRequest, res: Response) => {
    const attemptKey = String(req.ip);
    try {
        console.log("processLogin");
        assertLoginAllowed(attemptKey);
        requireFields(req.body, ["memberNick", "memberPassword"]);
        const input: LoginInput = req.body;
        const result = await memberService.processLogin(input);

        clearLoginFailures(attemptKey);
        req.session.member = toPlainJSON(result);
        req.session.save(function () {
            res.redirect("/admin/product/all");
        });
    } catch (err) {
        console.log("Error, processLogin", err);
        if (
            err instanceof Errors &&
            err.code !== HttpCode.TOO_MANY_REQUESTS
        )
            recordLoginFailure(attemptKey);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/login" });
    }
};

adminController.logout = async (req: AdminRequest, res: Response) => {
    try {
        console.log("logout");
        req.session.destroy(function () {
            res.redirect("/admin");
        });
    } catch (err) {
        console.log("Error, logout", err);
        res.redirect("/admin");
    }
};

adminController.checkAuthSession = async (req: AdminRequest, res: Response) => {
    try {
        console.log("checkAuthSession");
        if (req.session?.member)
            res.status(HttpCode.OK).json({ member: req.session.member });
        else
            throw new Errors(
                HttpCode.UNAUTHORIZED,
                Message.NOT_AUTHENTICATED
            );
    } catch (err) {
        console.log("Error, checkAuthSession", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

adminController.verifyAdmin = (
    req: AdminRequest,
    res: Response,
    next: NextFunction
) => {
    if (req.session?.member?.memberType === MemberType.ADMIN) {
        req.member = req.session.member;
        next();
    } else {
        const message = Message.NOT_AUTHENTICATED;
        res.render("error", { message: message, redirect: "/admin/login" });
    }
};

/** PROFILE */

adminController.getProfile = async (req: AdminRequest, res: Response) => {
    try {
        console.log("getProfile");
        const result = await memberService.getMemberDetail(req.member);
        res.render("profile", { profile: result });
    } catch (err) {
        console.log("Error, getProfile", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin" });
    }
};

adminController.updateProfile = async (req: AdminRequest, res: Response) => {
    try {
        console.log("updateProfile");
        const input: MemberUpdateInput = {
            _id: req.member._id,
            memberNick: req.body.memberNick,
            memberPhone: req.body.memberPhone,
            memberFullName: req.body.memberFullName,
            memberAddress: req.body.memberAddress,
            memberDesc: req.body.memberDesc,
        };

        const result = await memberService.updateMember(req.member, input);
        /* keep the header and guards in step with the new details */
        req.session.member = toPlainJSON(result);
        req.session.save(function () {
            res.redirect("/admin/profile");
        });
    } catch (err) {
        console.log("Error, updateProfile", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/profile" });
    }
};

adminController.changePassword = async (req: AdminRequest, res: Response) => {
    try {
        console.log("changePassword");
        requireFields(req.body, ["currentPassword", "newPassword"]);
        const input: PasswordChangeInput = {
            currentPassword: req.body.currentPassword,
            newPassword: req.body.newPassword,
        };
        if (req.body.newPassword !== req.body.confirmPassword)
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);

        await memberService.changePassword(req.member, input);
        /* a password change ends every other session for this admin */
        req.session.destroy(function () {
            res.redirect("/admin/login");
        });
    } catch (err) {
        console.log("Error, changePassword", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/profile" });
    }
};

/** USERS TAB */

adminController.getUsers = async (req: AdminRequest, res: Response) => {
    try {
        console.log("getUsers");
        const inquiry: MemberInquiry = {
            page: parsePage(req.query.page, 1),
            limit: parseLimit(req.query.limit, PAGE_SIZE),
            memberType: parseEnum(req.query.memberType, MemberType, {
                optional: true,
            }),
            memberStatus: parseEnum(req.query.memberStatus, MemberStatus, {
                optional: true,
            }),
            search:
                typeof req.query.search === "string"
                    ? req.query.search
                    : undefined,
        };

        const result = await memberService.getUsers(inquiry);
        res.render("users", {
            users: result.list,
            total: result.total,
            page: result.page,
            limit: result.limit,
            inquiry: inquiry,
            query: toQueryString({
                memberType: inquiry.memberType,
                memberStatus: inquiry.memberStatus,
                search: inquiry.search,
            }),
        });
    } catch (err) {
        console.log("Error, getUsers", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin" });
    }
};

adminController.createMember = async (req: AdminRequest, res: Response) => {
    try {
        console.log("createMember");
        requireFields(req.body, [
            "memberNick",
            "memberPhone",
            "memberPassword",
            "memberType",
        ]);
        const input: MemberInput = {
            memberNick: req.body.memberNick,
            memberPhone: req.body.memberPhone,
            memberPassword: req.body.memberPassword,
            memberFullName: req.body.memberFullName,
            memberType: parseEnum(
                req.body.memberType,
                MemberType
            ) as MemberType,
        };

        await memberService.createMember(input);
        res.redirect("/admin/user/all");
    } catch (err) {
        console.log("Error, createMember", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/user/all" });
    }
};

adminController.updateChosenUser = async (req: AdminRequest, res: Response) => {
    try {
        console.log("updateChosenUser");
        const input: MemberUpdateInput = {
            _id: parseObjectIdString(req.params.id) as any,
            memberStatus: parseEnum(req.body.memberStatus, MemberStatus, {
                optional: true,
            }),
            memberType: parseEnum(req.body.memberType, MemberType, {
                optional: true,
            }),
        };

        await memberService.updateChosenUser(input);
        res.redirect("/admin/user/all");
    } catch (err) {
        console.log("Error, updateChosenUser", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/user/all" });
    }
};

adminController.removeChosenUser = async (req: AdminRequest, res: Response) => {
    try {
        console.log("removeChosenUser");
        const id = parseObjectIdString(req.params.id);
        await memberService.removeChosenUser(id);
        res.redirect("/admin/user/all");
    } catch (err) {
        console.log("Error, removeChosenUser", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/user/all" });
    }
};

export default adminController;
