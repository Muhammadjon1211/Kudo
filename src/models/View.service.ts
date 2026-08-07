import ViewModel from "../schema/View.model";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { View, ViewInput } from "../libs/types/view";

/** mongo's duplicate-key error, which here means "already viewed" */
const DUPLICATE_KEY = 11000;

class ViewService {
    private readonly viewModel;

    constructor() {
        this.viewModel = ViewModel;
    }

    public async checkViewExistence(input: ViewInput): Promise<View | null> {
        const result = await this.viewModel
            .findOne({
                memberId: input.memberId,
                viewRefId: input.viewRefId,
                viewGroup: input.viewGroup,
            })
            .exec();

        return result as unknown as View | null;
    }

    /**
     * Answers null when the member had already viewed this document. Two tabs
     * opening the same product at once both clear the existence check, and the
     * loser arrives here — that is a duplicate view, not a failure, so the
     * caller simply skips the increment.
     */
    public async insertMemberView(input: ViewInput): Promise<View | null> {
        try {
            const result = await this.viewModel.create(input);
            return result as unknown as View;
        } catch (err: any) {
            if (err?.code === DUPLICATE_KEY) return null;
            console.log("Error, model:insertMemberView:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
        }
    }
}

export default ViewService;
