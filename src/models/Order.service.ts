import mongoose from "mongoose";
import OrderModel from "../schema/Order.model";
import OrderItemModel from "../schema/OrderItem.model";
import ProductModel from "../schema/Product.model";
import MemberService from "./Member.service";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/config";
import { OrderStatus } from "../libs/enums/order.enum";
import { ProductStatus } from "../libs/enums/product.enum";
import { Paginated, T } from "../libs/types/common";
import { Member } from "../libs/types/member";
import {
    Order,
    OrderInquiry,
    OrderItemInput,
    OrderUpdateInput,
} from "../libs/types/order";

/** free delivery once the basket reaches this subtotal */
const FREE_DELIVERY_FROM = 100;
const DELIVERY_COST = 5;

class OrderService {
    private readonly orderModel;
    private readonly orderItemModel;
    private readonly productModel;
    private readonly memberService;

    constructor() {
        this.orderModel = OrderModel;
        this.orderItemModel = OrderItemModel;
        this.productModel = ProductModel;
        this.memberService = new MemberService();
    }

    /** SPA */

    public async createOrder(
        member: Member,
        input: OrderItemInput[]
    ): Promise<Order> {
        if (!Array.isArray(input) || input.length === 0)
            throw new Errors(HttpCode.BAD_REQUEST, Message.EMPTY_ORDER);

        const memberId = shapeIntoMongooseObjectId(member._id);
        /* prices come from the database, never from the client payload */
        const priced = await this.priceOrderItems(input);
        const subtotal = priced.reduce(
            (sum, item) => sum + item.itemPrice * item.itemQuantity,
            0
        );
        const delivery = subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_COST;

        const session = await mongoose.startSession();
        try {
            let created: any;
            /* the order and its items must land together or not at all */
            await session.withTransaction(async () => {
                const [order] = await this.orderModel.create(
                    [
                        {
                            orderTotal: subtotal + delivery,
                            orderDelivery: delivery,
                            memberId: memberId,
                        },
                    ],
                    { session }
                );

                await this.orderItemModel.create(
                    priced.map((item) => ({ ...item, orderId: order._id })),
                    { session }
                );

                await this.reserveStock(priced, session);
                created = order;
            });

            return created.toJSON() as unknown as Order;
        } catch (err) {
            console.log("Error, model:createOrder:", err);
            if (err instanceof Errors) throw err;
            throw new Errors(
                HttpCode.BAD_REQUEST,
                Message.ORDER_CREATION_FAILED
            );
        } finally {
            await session.endSession();
        }
    }

    public async getMyOrders(
        member: Member,
        inquiry: OrderInquiry
    ): Promise<Order[]> {
        const memberId = shapeIntoMongooseObjectId(member._id);
        const matches: T = {
            memberId: memberId,
            orderStatus: inquiry.orderStatus,
        };

        const result = await this.orderModel
            .aggregate([
                { $match: matches },
                { $sort: { updatedAt: -1 } },
                { $skip: (inquiry.page - 1) * inquiry.limit },
                { $limit: inquiry.limit },
                {
                    $lookup: {
                        from: "orderItems",
                        localField: "_id",
                        foreignField: "orderId",
                        as: "orderItems",
                    },
                },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderItems.productId",
                        foreignField: "_id",
                        as: "productData",
                    },
                },
            ])
            .exec();

        return result as Order[];
    }

    public async updateOrder(
        member: Member,
        input: OrderUpdateInput
    ): Promise<Order> {
        const memberId = shapeIntoMongooseObjectId(member._id),
            orderId = shapeIntoMongooseObjectId(input.orderId);

        /* the ownership filter belongs in findOneAndUpdate, not findByIdAndUpdate */
        return await this.applyOrderStatus(
            { _id: orderId, memberId: memberId },
            input.orderStatus
        );
    }

    /** SSR */

    public async getAllOrders(
        inquiry: OrderInquiry
    ): Promise<Paginated<Order>> {
        const matches: T = {};
        if (inquiry.orderStatus) matches.orderStatus = inquiry.orderStatus;

        const [result] = await this.orderModel
            .aggregate([
                { $match: matches },
                {
                    $facet: {
                        list: [
                            { $sort: { updatedAt: -1 } },
                            { $skip: (inquiry.page - 1) * inquiry.limit },
                            { $limit: inquiry.limit },
                            {
                                $lookup: {
                                    from: "orderItems",
                                    localField: "_id",
                                    foreignField: "orderId",
                                    as: "orderItems",
                                },
                            },
                            {
                                $lookup: {
                                    from: "products",
                                    localField: "orderItems.productId",
                                    foreignField: "_id",
                                    as: "productData",
                                },
                            },
                            /* the buyer, minus the password hash */
                            {
                                $lookup: {
                                    from: "members",
                                    let: { buyerId: "$memberId" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $eq: ["$_id", "$$buyerId"],
                                                },
                                            },
                                        },
                                        { $project: { memberPassword: 0 } },
                                    ],
                                    as: "memberData",
                                },
                            },
                        ],
                        total: [{ $count: "count" }],
                    },
                },
            ])
            .exec();

        return {
            list: result.list as Order[],
            total: result.total[0]?.count ?? 0,
            page: inquiry.page,
            limit: inquiry.limit,
        };
    }

    public async updateChosenOrder(
        id: string,
        status: OrderStatus
    ): Promise<Order> {
        const orderId = shapeIntoMongooseObjectId(id);
        /* the panel awards the same point the API path does */
        return await this.applyOrderStatus({ _id: orderId }, status);
    }

    public async countOrders(status?: OrderStatus): Promise<number> {
        const match: T = status
            ? { orderStatus: status }
            : { orderStatus: { $ne: OrderStatus.DELETE } };
        return await this.orderModel.countDocuments(match).exec();
    }

    /** helpers */

    private async applyOrderStatus(
        filter: T,
        status: OrderStatus
    ): Promise<Order> {
        /* new:false hands back the previous state, so the point is awarded
           once on the PAUSE -> PROCESS transition and not on every re-save */
        const previous = await this.orderModel
            .findOneAndUpdate(filter, { orderStatus: status }, { new: false })
            .exec();
        if (!previous)
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);

        if (
            status === OrderStatus.PROCESS &&
            previous.orderStatus !== OrderStatus.PROCESS
        )
            await this.awardPoint(previous.memberId);

        return {
            ...(previous.toJSON() as unknown as Order),
            orderStatus: status,
        };
    }

    /** a point is a courtesy: never fail a status change over it */
    private async awardPoint(memberId: any): Promise<void> {
        try {
            await this.memberService.addUserPoint(
                { _id: memberId } as Member,
                1
            );
        } catch (err) {
            console.log("Error, model:awardPoint: point not awarded");
        }
    }

    private async priceOrderItems(
        input: OrderItemInput[]
    ): Promise<OrderItemInput[]> {
        return await Promise.all(
            input.map(async (item) => {
                const productId = shapeIntoMongooseObjectId(item.productId);
                const product = await this.productModel
                    .findOne({
                        _id: productId,
                        productStatus: ProductStatus.PROCESS,
                    })
                    .exec();
                if (!product)
                    throw new Errors(
                        HttpCode.NOT_FOUND,
                        Message.NO_DATA_FOUND
                    );

                /* stock lives per size, so the chosen size decides the check */
                const size = (product.productSizes ?? []).find(
                    (entry: any) => entry.sizeName === item.itemSize
                );
                if (!size)
                    throw new Errors(
                        HttpCode.NOT_FOUND,
                        Message.SIZE_NOT_AVAILABLE
                    );
                if (size.sizeLeftCount < item.itemQuantity)
                    throw new Errors(
                        HttpCode.CONFLICT,
                        Message.PRODUCT_OUT_OF_STOCK
                    );

                return {
                    itemQuantity: item.itemQuantity,
                    itemPrice: product.productPrice as number,
                    itemSize: item.itemSize,
                    productId: productId,
                };
            })
        );
    }

    private async reserveStock(
        items: OrderItemInput[],
        session: mongoose.ClientSession
    ): Promise<void> {
        await Promise.all(
            items.map(async (item) => {
                const result = await this.productModel
                    .updateOne(
                        {
                            _id: item.productId,
                            productSizes: {
                                $elemMatch: {
                                    sizeName: item.itemSize,
                                    sizeLeftCount: { $gte: item.itemQuantity },
                                },
                            },
                        },
                        {
                            $inc: {
                                "productSizes.$.sizeLeftCount":
                                    -item.itemQuantity,
                            },
                        },
                        { session }
                    )
                    .exec();
                /* a concurrent order may have taken the last unit of that size */
                if (result.modifiedCount !== 1)
                    throw new Errors(
                        HttpCode.CONFLICT,
                        Message.PRODUCT_OUT_OF_STOCK
                    );
            })
        );
    }
}

export default OrderService;
