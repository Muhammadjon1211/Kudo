import { ObjectId } from "mongoose";
import BlogModel from "../schema/Blog.model";
import ViewService from "./View.service";
import LikeService from "./Like.service";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { BlogStatus } from "../libs/enums/blog.enum";
import { ViewGroup } from "../libs/enums/view.enum";
import { LikeGroup } from "../libs/enums/like.enum";
import { Paginated, T } from "../libs/types/common";
import { ViewInput } from "../libs/types/view";
import { LikeInput } from "../libs/types/like";
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

/**
 * Marks each post with whether this member has liked it, so the list can render
 * the toggle without a second round trip.
 */
const favoriteLookup = (memberId: ObjectId) => [
    {
        $lookup: {
            from: "likes",
            let: { blogId: "$_id" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$likeRefId", "$$blogId"] },
                                { $eq: ["$memberId", memberId] },
                                { $eq: ["$likeGroup", LikeGroup.BLOG] },
                            ],
                        },
                    },
                },
            ],
            as: "myLike",
        },
    },
    { $addFields: { myFavorite: { $gt: [{ $size: "$myLike" }, 0] } } },
    { $project: { myLike: 0 } },
];

class BlogService {
    private readonly blogModel;
    private readonly viewService;
    private readonly likeService;

    constructor() {
        this.blogModel = BlogModel;
        this.viewService = new ViewService();
        this.likeService = new LikeService();
    }

    /** SPA */

    public async getBlogs(
        inquiry: BlogInquiry,
        memberId?: ObjectId | null
    ): Promise<Blog[]> {
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
                ...(memberId
                    ? favoriteLookup(shapeIntoMongooseObjectId(memberId))
                    : []),
            ])
            .exec();

        return result as Blog[];
    }

    /**
     * `memberId` is whatever `retrieveAuth` left on the request, so it is null
     * for a guest. As with products the view counter is per member: a guest
     * reading, a refresh and a second tab all leave it alone.
     */
    public async getBlog(
        id: string,
        memberId?: ObjectId | null
    ): Promise<Blog> {
        const blogId = shapeIntoMongooseObjectId(id);
        let result = await this.blogModel
            .findOne({ _id: blogId, blogStatus: BlogStatus.PUBLISHED })
            .exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        if (!memberId) return result.toJSON() as unknown as Blog;

        const viewerId = shapeIntoMongooseObjectId(memberId);
        const viewInput: ViewInput = {
            memberId: viewerId,
            viewRefId: blogId,
            viewGroup: ViewGroup.BLOG,
        };

        const existView = await this.viewService.checkViewExistence(viewInput);
        if (!existView) {
            const inserted = await this.viewService.insertMemberView(viewInput);
            /* null means another request won the race and already counted */
            if (inserted) {
                const updated = await this.blogModel
                    .findByIdAndUpdate(
                        blogId,
                        { $inc: { blogViews: 1 } },
                        { new: true }
                    )
                    .exec();
                if (updated) result = updated;
            }
        }

        const myFavorite = await this.likeService.checkLikeExistence({
            memberId: viewerId,
            likeRefId: blogId,
            likeGroup: LikeGroup.BLOG,
        });

        return {
            ...(result.toJSON() as unknown as Blog),
            myFavorite: myFavorite,
        };
    }

    /** flips this member's like and moves the post's counter to match */
    public async likeTargetBlog(
        memberId: ObjectId,
        id: string
    ): Promise<Blog> {
        const blogId = shapeIntoMongooseObjectId(id);
        const target = await this.blogModel
            .findOne({ _id: blogId, blogStatus: BlogStatus.PUBLISHED })
            .exec();
        if (!target)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        const input: LikeInput = {
            memberId: shapeIntoMongooseObjectId(memberId),
            likeRefId: blogId,
            likeGroup: LikeGroup.BLOG,
        };
        const { liked, modifier } = await this.likeService.toggleLike(input);

        let result = target;
        if (modifier !== 0) {
            /* a pipeline update so the counter can never be driven negative by
               drift between the rows and the tally */
            const updated = await this.blogModel
                .findByIdAndUpdate(
                    blogId,
                    [
                        {
                            $set: {
                                /* $ifNull because posts written before the
                                   field existed have no blogLikes at all, and
                                   $add against a missing field yields null */
                                blogLikes: {
                                    $max: [
                                        0,
                                        {
                                            $add: [
                                                { $ifNull: ["$blogLikes", 0] },
                                                modifier,
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                    { new: true }
                )
                .exec();
            if (updated) result = updated;
        }

        return {
            ...(result.toJSON() as unknown as Blog),
            myFavorite: liked,
        };
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
