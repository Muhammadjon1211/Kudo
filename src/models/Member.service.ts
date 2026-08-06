import bcrypt from "bcryptjs";
import MemberModel from "../schema/Member.model";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { MemberStatus, MemberType } from "../libs/enums/member.enum";
import { Paginated, T } from "../libs/types/common";
import {
    LoginInput,
    Member,
    MemberInput,
    MemberInquiry,
    MemberUpdateInput,
    PasswordChangeInput,
} from "../libs/types/member";

const SALT_ROUNDS = 10;

class MemberService {
    private readonly memberModel;

    constructor() {
        this.memberModel = MemberModel;
    }

    /** SPA */

    public async signup(input: MemberInput): Promise<Member> {
        /* the public surface may only ever create students */
        input.memberType = MemberType.STUDENT;
        input.memberPassword = await bcrypt.hash(
            input.memberPassword,
            SALT_ROUNDS
        );

        try {
            const result = await this.memberModel.create(input);
            result.memberPassword = "";
            return result.toJSON() as unknown as Member;
        } catch (err) {
            console.log("Error, model:signup:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.USED_NICK_PHONE);
        }
    }

    public async login(input: LoginInput): Promise<Member> {
        const member = await this.memberModel
            .findOne(
                {
                    memberNick: input.memberNick,
                    memberStatus: { $ne: MemberStatus.DELETE },
                },
                { memberNick: 1, memberPassword: 1, memberStatus: 1 }
            )
            .exec();
        if (!member)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_MEMBER_NICK);
        if (member.memberStatus === MemberStatus.BLOCK)
            throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);

        const isMatch = await bcrypt.compare(
            input.memberPassword,
            member.memberPassword as string
        );
        if (!isMatch)
            throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);

        return await this.getMemberDetail({
            _id: member._id,
        } as unknown as Member);
    }

    public async getMemberDetail(member: Member): Promise<Member> {
        const memberId = shapeIntoMongooseObjectId(member._id);
        const result = await this.memberModel
            .findOne({ _id: memberId, memberStatus: MemberStatus.ACTIVE })
            .exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result.toJSON() as unknown as Member;
    }

    public async updateMember(
        member: Member,
        input: MemberUpdateInput
    ): Promise<Member> {
        const memberId = shapeIntoMongooseObjectId(member._id);
        /* a member may never promote itself or change its own status */
        delete input.memberType;
        delete input.memberStatus;

        const result = await this.memberModel
            .findOneAndUpdate({ _id: memberId }, input, { new: true })
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

        return result.toJSON() as unknown as Member;
    }

    public async addUserPoint(member: Member, point: number): Promise<Member> {
        const memberId = shapeIntoMongooseObjectId(member._id);
        const result = await this.memberModel
            .findOneAndUpdate(
                {
                    _id: memberId,
                    memberType: MemberType.STUDENT,
                    memberStatus: MemberStatus.ACTIVE,
                },
                { $inc: { memberPoints: point } },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

        return result.toJSON() as unknown as Member;
    }

    /** SSR */

    public async processSignup(input: MemberInput): Promise<Member> {
        /* the admin account bootstraps the panel and may exist only once */
        const exist = await this.memberModel
            .findOne({ memberType: MemberType.ADMIN })
            .exec();
        if (exist)
            throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);

        input.memberType = MemberType.ADMIN;
        input.memberPassword = await bcrypt.hash(
            input.memberPassword,
            SALT_ROUNDS
        );

        try {
            const result = await this.memberModel.create(input);
            result.memberPassword = "";
            return result.toJSON() as unknown as Member;
        } catch (err) {
            console.log("Error, model:processSignup:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.USED_NICK_PHONE);
        }
    }

    public async processLogin(input: LoginInput): Promise<Member> {
        const member = await this.memberModel
            .findOne(
                { memberNick: input.memberNick, memberType: MemberType.ADMIN },
                { memberNick: 1, memberPassword: 1, memberStatus: 1 }
            )
            .exec();
        if (!member)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_MEMBER_NICK);
        if (member.memberStatus !== MemberStatus.ACTIVE)
            throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);

        const isMatch = await bcrypt.compare(
            input.memberPassword,
            member.memberPassword as string
        );
        if (!isMatch)
            throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);

        return await this.getMemberDetail({
            _id: member._id,
        } as unknown as Member);
    }

    public async createMember(input: MemberInput): Promise<Member> {
        /* the panel creates staff accounts; students self-register */
        if (input.memberType === MemberType.STUDENT)
            throw new Errors(HttpCode.BAD_REQUEST, Message.NOT_ALLOWED_REQUEST);

        input.memberPassword = await bcrypt.hash(
            input.memberPassword,
            SALT_ROUNDS
        );

        try {
            const result = await this.memberModel.create(input);
            result.memberPassword = "";
            return result.toJSON() as unknown as Member;
        } catch (err) {
            console.log("Error, model:createMember:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.USED_NICK_PHONE);
        }
    }

    public async getUsers(
        inquiry: MemberInquiry
    ): Promise<Paginated<Member>> {
        const match: T = { memberStatus: { $ne: MemberStatus.DELETE } };
        if (inquiry.memberType) match.memberType = inquiry.memberType;
        if (inquiry.memberStatus) match.memberStatus = inquiry.memberStatus;
        if (inquiry.search)
            match.memberNick = { $regex: new RegExp(inquiry.search, "i") };

        const [result] = await this.memberModel
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
            list: result.list as Member[],
            total: result.total[0]?.count ?? 0,
            page: inquiry.page,
            limit: inquiry.limit,
        };
    }

    public async countMembers(): Promise<number> {
        return await this.memberModel
            .countDocuments({ memberStatus: { $ne: MemberStatus.DELETE } })
            .exec();
    }

    public async changePassword(
        member: Member,
        input: PasswordChangeInput
    ): Promise<void> {
        if (!input.newPassword || input.newPassword.length < 8)
            throw new Errors(HttpCode.BAD_REQUEST, Message.PASSWORD_TOO_SHORT);
        if (input.newPassword === input.currentPassword)
            throw new Errors(HttpCode.BAD_REQUEST, Message.SAME_PASSWORD);

        const memberId = shapeIntoMongooseObjectId(member._id);
        const existing = await this.memberModel
            .findOne({ _id: memberId }, { memberPassword: 1 })
            .exec();
        if (!existing)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        const isMatch = await bcrypt.compare(
            input.currentPassword,
            existing.memberPassword as string
        );
        if (!isMatch)
            throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);

        const hashed = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
        const result = await this.memberModel
            .findOneAndUpdate(
                { _id: memberId },
                { memberPassword: hashed },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
    }

    public async updateChosenUser(input: MemberUpdateInput): Promise<Member> {
        const memberId = shapeIntoMongooseObjectId(input._id);
        const result = await this.memberModel
            .findOneAndUpdate({ _id: memberId }, input, { new: true })
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

        return result.toJSON() as unknown as Member;
    }

    public async removeChosenUser(id: string): Promise<void> {
        const memberId = shapeIntoMongooseObjectId(id);
        const result = await this.memberModel
            .findOneAndUpdate(
                { _id: memberId, memberType: { $ne: MemberType.ADMIN } },
                { memberStatus: MemberStatus.DELETE },
                { new: true }
            )
            .exec();
        if (!result)
            throw new Errors(HttpCode.BAD_REQUEST, Message.DELETE_FAILED);
    }
}

export default MemberService;
