import { ObjectId } from "mongoose";
import { OrderStatus } from "../enums/order.enum";
import { ProductSize } from "../enums/product.enum";
import { Member } from "./member";
import { Product } from "./product";

export interface OrderItem {
    _id: ObjectId;
    itemQuantity: number;
    itemPrice: number;
    itemSize: ProductSize;
    orderId: ObjectId;
    productId: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderItemInput {
    itemQuantity: number;
    itemPrice: number;
    itemSize: ProductSize;
    orderId?: ObjectId;
    productId: ObjectId;
}

export interface Order {
    _id: ObjectId;
    orderTotal: number;
    orderDelivery: number;
    orderStatus: OrderStatus;
    memberId: ObjectId;
    createdAt: Date;
    updatedAt: Date;

    /* from aggregations */
    orderItems?: OrderItem[];
    productData?: Product[];
    memberData?: Member[];
}

export interface OrderUpdateInput {
    orderId: string;
    orderStatus: OrderStatus;
}

export interface OrderInquiry {
    page: number;
    limit: number;
    orderStatus: OrderStatus;
}
