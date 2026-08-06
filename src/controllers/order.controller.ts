import { Request, Response } from "express";
import { Controller } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import OrderService from "../models/Order.service";
import { OrderStatus } from "../libs/enums/order.enum";
import { ProductSize } from "../libs/enums/product.enum";
import { OrderInquiry, OrderItemInput } from "../libs/types/order";
import { AdminRequest, ExtendedRequest } from "../libs/types/member";
import {
    parseEnum,
    parseLimit,
    parseNumber,
    parseObjectIdString,
    parsePage,
} from "../libs/utils/validate";
import { toQueryString } from "../libs/utils/query";

const orderService = new OrderService();
const orderController: Controller = {};

/** SPA */

orderController.createOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("createOrder");
        if (!Array.isArray(req.body) || req.body.length === 0)
            throw new Errors(HttpCode.BAD_REQUEST, Message.EMPTY_ORDER);

        const input: OrderItemInput[] = req.body.map((item: any) => ({
            itemQuantity: parseNumber(item.itemQuantity, { min: 1 }),
            itemPrice: 0 /* recomputed from the catalogue in the service */,
            itemSize: parseEnum(item.itemSize, ProductSize) as ProductSize,
            productId: parseObjectIdString(item.productId) as any,
        }));

        const result = await orderService.createOrder(req.member, input);
        res.status(HttpCode.CREATED).json(result);
    } catch (err) {
        console.log("Error, createOrder", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

orderController.getMyOrders = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getMyOrders");
        const { page, limit, orderStatus } = req.query;
        const inquiry: OrderInquiry = {
            page: parsePage(page),
            limit: parseLimit(limit),
            orderStatus: parseEnum(orderStatus, OrderStatus) as OrderStatus,
        };

        const result = await orderService.getMyOrders(req.member, inquiry);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getMyOrders", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

orderController.updateOrder = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("updateOrder");
        const input = {
            orderId: parseObjectIdString(req.body.orderId),
            orderStatus: parseEnum(
                req.body.orderStatus,
                OrderStatus
            ) as OrderStatus,
        };

        const result = await orderService.updateOrder(req.member, input);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, updateOrder", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** SSR */

orderController.getAllOrders = async (req: Request, res: Response) => {
    try {
        console.log("getAllOrders");
        const inquiry: OrderInquiry = {
            page: parsePage(req.query.page, 1),
            limit: parseLimit(req.query.limit, 20),
            orderStatus: parseEnum(req.query.orderStatus, OrderStatus, {
                optional: true,
            }) as OrderStatus,
        };

        const result = await orderService.getAllOrders(inquiry);
        res.render("orders", {
            orders: result.list,
            total: result.total,
            page: result.page,
            limit: result.limit,
            inquiry: inquiry,
            query: toQueryString({ orderStatus: inquiry.orderStatus }),
        });
    } catch (err) {
        console.log("Error, getAllOrders", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin" });
    }
};

orderController.updateChosenOrder = async (
    req: AdminRequest,
    res: Response
) => {
    try {
        console.log("updateChosenOrder");
        const id = parseObjectIdString(req.params.id),
            status = parseEnum(
                req.body.orderStatus,
                OrderStatus
            ) as OrderStatus;

        await orderService.updateChosenOrder(id, status);
        res.redirect("/admin/order/all");
    } catch (err) {
        console.log("Error, updateChosenOrder", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/order/all" });
    }
};

export default orderController;
