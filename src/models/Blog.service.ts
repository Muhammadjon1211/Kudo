import BlogModel from "../schema/Blog.model";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { BlogStatus } from "../libs/enums/blog.enum";
import { Paginated, T } from "../libs/types/common";
import {
    Blog,
    BlogInput,
    BlogInquiry,
    BlogUpdateInput,
} from "../libs/types/blog";

/** a joined author must never carry the password hash into a JSON response */
const AUTHOR_LOOKUP = {
    $lookup: {
        from: "members",
        let: { authorId: "$blogAuthorId" },
        pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$authorId"] } } },
            { $project: { memberPassword: 0 } },
        ],
        as: "authorData",
    },
};

class BlogService {
    private readonly blogModel;

    constructor() {
        this.blogModel = BlogModel;
    }

    /** SPA */

    public async getBlogs(inquiry: BlogInquiry): Promise<Blog[]> {
        const match: T = { blogStatus: BlogStatus.PUBLISHED };
        if (inquiry.search)
            match.blogTitle = { $regex: new RegExp(inquiry.search, "i") };

        const sort: T = { [inquiry.order ?? "createdAt"]: -1 };

        const result = await this.blogModel
            .aggregate([
                { $match: match },
                { $sort: sort },
                { $skip: (inquiry.page - 1) * inquiry.limit },
                { $limit: inquiry.limit },
                AUTHOR_LOOKUP,
            ])
            .exec();

        return result as Blog[];
    }

    public async getBlog(id: string): Promise<Blog> {
        const blogId = shapeIntoMongooseObjectId(id);
        const result = await this.blogModel
            .findOne({ _id: blogId, blogStatus: BlogStatus.PUBLISHED })
            .exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        await this.blogModel
            .findByIdAndUpdate(blogId, { $inc: { blogViews: 1 } })
            .exec();

        return result.toJSON() as unknown as Blog;
    }

    /** SSR */

    public async getAllBlogs(inquiry: BlogInquiry): Promise<Paginated<Blog>> {
        /* removed posts stay listable so the admin can restore them */
        const match: T = inquiry.blogStatus
            ? { blogStatus: inquiry.blogStatus }
            : { blogStatus: { $ne: BlogStatus.DELETE } };
        if (inquiry.search)
            match.blogTitle = { $regex: new RegExp(inquiry.search, "i") };

        const [result] = await this.blogModel
            .aggregate([
                { $match: match },
                {
                    $facet: {
                        list: [
                            { $sort: { createdAt: -1 } },
                            { $skip: (inquiry.page - 1) * inquiry.limit },
                            { $limit: inquiry.limit },
                        ],
                        total: [{ $count: "count" }],
                    },
                },
            ])
            .exec();

        return {
            list: result.list as Blog[],
            total: result.total[0]?.count ?? 0,
            page: inquiry.page,
            limit: inquiry.limit,
        };
    }

    public async getChosenBlog(id: string): Promise<Blog> {
        const blogId = shapeIntoMongooseObjectId(id);
        const result = await this.blogModel.findOne({ _id: blogId }).exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result.toJSON() as unknown as Blog;
    }

    public async countBlogs(): Promise<number> {
        return await this.blogModel
            .countDocuments({ blogStatus: { $ne: BlogStatus.DELETE } })
            .exec();
    }

    public async createNewBlog(input: BlogInput): Promise<Blog> {
        try {
            const result = await this.blogModel.create(input);
            return result.toJSON() as unknown as Blog;
        } catch (err) {
            console.log("Error, model:createNewBlog:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }

    public async updateChosenBlog(
        id: string,
        input: BlogUpdateInput
    ): Promise<Blog> {
        const blogId = shapeIntoMongooseObjectId(id);
        const result = await this.blogModel
            .findOneAndUpdate({ _id: blogId }, input, { new: true })
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

        return result.toJSON() as unknown as Blog;
    }

    public async removeChosenBlog(id: string): Promise<void> {
        const blogId = shapeIntoMongooseObjectId(id);
        const result = await this.blogModel
            .findOneAndUpdate(
                { _id: blogId },
                { blogStatus: BlogStatus.DELETE },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.DELETE_FAILED);
    }
}

export default BlogService;
