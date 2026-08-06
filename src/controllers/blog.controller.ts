import { Request, Response } from "express";
import { Controller } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import BlogService from "../models/Blog.service";
import { BlogStatus } from "../libs/enums/blog.enum";
import { BlogInput, BlogInquiry, BlogUpdateInput } from "../libs/types/blog";
import { AdminRequest } from "../libs/types/member";
import {
    normalizePath,
    parseEnum,
    parseLimit,
    parseObjectIdString,
    parsePage,
    requireFields,
} from "../libs/utils/validate";
import { toQueryString } from "../libs/utils/query";

const blogService = new BlogService();
const blogController: Controller = {};

const PAGE_SIZE = 20;

/** SPA */

blogController.getBlogs = async (req: Request, res: Response) => {
    try {
        console.log("getBlogs");
        const { page, limit, order, search } = req.query;
        const inquiry: BlogInquiry = {
            page: parsePage(page),
            limit: parseLimit(limit),
            order: typeof order === "string" ? order : "createdAt",
            search: typeof search === "string" ? search : undefined,
        };

        const result = await blogService.getBlogs(inquiry);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getBlogs", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

blogController.getBlog = async (req: Request, res: Response) => {
    try {
        console.log("getBlog");
        const id = parseObjectIdString(req.params.id);
        const result = await blogService.getBlog(id);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getBlog", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** SSR */

blogController.getAllBlogs = async (req: Request, res: Response) => {
    try {
        console.log("getAllBlogs");
        const inquiry: BlogInquiry = {
            page: parsePage(req.query.page, 1),
            limit: parseLimit(req.query.limit, PAGE_SIZE),
            blogStatus: parseEnum(req.query.blogStatus, BlogStatus, {
                optional: true,
            }),
            search:
                typeof req.query.search === "string"
                    ? req.query.search
                    : undefined,
        };

        const result = await blogService.getAllBlogs(inquiry);
        res.render("blogs", {
            blogs: result.list,
            total: result.total,
            page: result.page,
            limit: result.limit,
            inquiry: inquiry,
            query: toQueryString({
                blogStatus: inquiry.blogStatus,
                search: inquiry.search,
            }),
        });
    } catch (err) {
        console.log("Error, getAllBlogs", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin" });
    }
};

/** the full editor for one post: title, text, image and status */
blogController.getChosenBlog = async (req: AdminRequest, res: Response) => {
    try {
        console.log("getChosenBlog");
        const id = parseObjectIdString(req.params.id);
        const result = await blogService.getChosenBlog(id);
        res.render("blog-edit", { blog: result });
    } catch (err) {
        console.log("Error, getChosenBlog", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/blog/all" });
    }
};

blogController.createNewBlog = async (req: AdminRequest, res: Response) => {
    try {
        console.log("createNewBlog");
        requireFields(req.body, ["blogTitle", "blogContent"]);
        const input: BlogInput = {
            blogTitle: String(req.body.blogTitle).trim(),
            blogContent: String(req.body.blogContent),
            blogStatus: parseEnum(req.body.blogStatus, BlogStatus, {
                optional: true,
            }),
            blogAuthorId: req.member._id,
        };
        if (req.file) input.blogImage = normalizePath(req.file.path);

        await blogService.createNewBlog(input);
        res.redirect("/admin/blog/all");
    } catch (err) {
        console.log("Error, createNewBlog", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/blog/all" });
    }
};

blogController.updateChosenBlog = async (req: AdminRequest, res: Response) => {
    try {
        console.log("updateChosenBlog");
        const id = parseObjectIdString(req.params.id);
        const input: BlogUpdateInput = {} as BlogUpdateInput;

        if (req.body.blogTitle)
            input.blogTitle = String(req.body.blogTitle).trim();
        if (req.body.blogContent)
            input.blogContent = String(req.body.blogContent);
        if (req.body.blogStatus)
            input.blogStatus = parseEnum(
                req.body.blogStatus,
                BlogStatus
            ) as BlogStatus;
        if (req.file) input.blogImage = normalizePath(req.file.path);

        await blogService.updateChosenBlog(id, input);
        res.redirect("/admin/blog/all");
    } catch (err) {
        console.log("Error, updateChosenBlog", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/blog/all" });
    }
};

blogController.removeChosenBlog = async (req: AdminRequest, res: Response) => {
    try {
        console.log("removeChosenBlog");
        const id = parseObjectIdString(req.params.id);
        await blogService.removeChosenBlog(id);
        res.redirect("/admin/blog/all");
    } catch (err) {
        console.log("Error, removeChosenBlog", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/blog/all" });
    }
};

export default blogController;
