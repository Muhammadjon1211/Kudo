import LikeModel from "../schema/Like.model";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { LikeInput, LikeToggle } from "../libs/types/like";

/** mongo's duplicate-key error, which here means "already liked" */
const DUPLICATE_KEY = 11000;

class LikeService {
    private readonly likeModel;

    constructor() {
        this.likeModel = LikeModel;
    }

    /**
     * Flips the member's like on or off. The delete is the test: if a row was
     * there it is now gone and this was an unlike, otherwise it is a like.
     * Doing it that way keeps the decision atomic, so a double-tap cannot land
     * two likes.
     */
    public async toggleLike(input: LikeInput): Promise<LikeToggle> {
        const removed = await this.likeModel.findOneAndDelete(input).exec();
        if (removed) return { liked: false, modifier: -1 };

        try {
            await this.likeModel.create(input);
            return { liked: true, modifier: 1 };
        } catch (err: any) {
            /* a racing request created it first: the member ends up liked
               either way, but the counter must not move twice */
            if (err?.code === DUPLICATE_KEY) return { liked: true, modifier: 0 };
            console.log("Error, model:toggleLike:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }

    public async checkLikeExistence(input: LikeInput): Promise<boolean> {
        const result = await this.likeModel.findOne(input).exec();
        return Boolean(result);
    }
}

export default LikeService;
