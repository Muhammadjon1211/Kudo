import { Request, Response } from "express";
import { Controller } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import ProductService from "../models/Product.service";
import { ProductSize, ProductStatus } from "../libs/enums/product.enum";
import {
    ProductInput,
    ProductInquiry,
    ProductSizeStock,
    ProductUpdateInput,
} from "../libs/types/product";
import { AdminRequest, ExtendedRequest } from "../libs/types/member";
import {
    normalizePath,
    parseEnum,
    parseLimit,
    parseNumber,
    parseObjectIdString,
    parsePage,
    requireFields,
} from "../libs/utils/validate";
import { toQueryString } from "../libs/utils/query";

const productService = new ProductService();
const productController: Controller = {};

const PAGE_SIZE = 20;

/**
 * The admin form ticks a checkbox per size (`productSizes`) and types the stock
 * for each one into `sizeCount_<SIZE>`. A single ticked box arrives as a string
 * rather than an array, so both shapes are normalised here.
 */
const parseProductSizes = (body: any): ProductSizeStock[] => {
    const raw = body.productSizes;
    const chosen: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (!chosen.length)
        throw new Errors(HttpCode.BAD_REQUEST, Message.NO_SIZES_CHOSEN);

    return chosen.map((size) => ({
        sizeName: parseEnum(size, ProductSize) as ProductSize,
        sizeLeftCount: parseNumber(body[`sizeCount_${size}`] ?? 0),
    }));
};

/** SPA */

productController.getProducts = async (req: Request, res: Response) => {
    try {
        console.log("getProducts");
        const { page, limit, order, search } = req.query;
        const inquiry: ProductInquiry = {
            page: parsePage(page),
            limit: parseLimit(limit),
            order: typeof order === "string" ? order : "createdAt",
            search: typeof search === "string" ? search : undefined,
        };

        const result = await productService.getProducts(inquiry);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getProducts", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

productController.getProduct = async (req: ExtendedRequest, res: Response) => {
    try {
        console.log("getProduct");
        const id = parseObjectIdString(req.params.id);
        /* retrieveAuth sets req.member only for a signed-in visitor, and the
           service counts the view only when there is one */
        const result = await productService.getProduct(id, req.member?._id);
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getProduct", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** SSR */

productController.getAllProducts = async (req: Request, res: Response) => {
    try {
        console.log("getAllProducts");
        const inquiry: ProductInquiry = {
            page: parsePage(req.query.page, 1),
            limit: parseLimit(req.query.limit, PAGE_SIZE),
            order: "createdAt",
            productStatus: parseEnum(req.query.productStatus, ProductStatus, {
                optional: true,
            }),
            search:
                typeof req.query.search === "string"
                    ? req.query.search
                    : undefined,
        };

        const result = await productService.getAllProducts(inquiry);
        res.render("products", {
            products: result.list,
            total: result.total,
            page: result.page,
            limit: result.limit,
            inquiry: inquiry,
            sizes: Object.values(ProductSize),
            query: toQueryString({
                productStatus: inquiry.productStatus,
                search: inquiry.search,
            }),
        });
    } catch (err) {
        console.log("Error, getAllProducts", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin" });
    }
};

productController.createNewProduct = async (
    req: AdminRequest,
    res: Response
) => {
    try {
        console.log("createNewProduct");
        requireFields(req.body, ["productName", "productPrice"]);
        const files = (req.files as Express.Multer.File[]) ?? [];
        const input: ProductInput = {
            productName: String(req.body.productName).trim(),
            productPrice: parseNumber(req.body.productPrice),
            productSizes: parseProductSizes(req.body),
            productStatus: parseEnum(req.body.productStatus, ProductStatus, {
                optional: true,
            }),
            productDesc: req.body.productDesc,
            productImages: files.map((file) => normalizePath(file.path)),
        };

        await productService.createNewProduct(input);
        res.redirect("/admin/product/all");
    } catch (err) {
        console.log("Error, createNewProduct", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/product/all" });
    }
};

productController.updateChosenProduct = async (
    req: AdminRequest,
    res: Response
) => {
    try {
        console.log("updateChosenProduct");
        const id = parseObjectIdString(req.params.id);
        const files = (req.files as Express.Multer.File[]) ?? [];
        const input: ProductUpdateInput = {} as ProductUpdateInput;

        if (req.body.productName)
            input.productName = String(req.body.productName).trim();
        if (req.body.productDesc !== undefined)
            input.productDesc = req.body.productDesc;
        if (req.body.productPrice !== undefined)
            input.productPrice = parseNumber(req.body.productPrice);
        if (req.body.productStatus)
            input.productStatus = parseEnum(
                req.body.productStatus,
                ProductStatus
            ) as ProductStatus;
        if (req.body.productSizes)
            input.productSizes = parseProductSizes(req.body);

        await productService.updateChosenProduct(id, input);
        /* uploads are appended, so editing never wipes the gallery */
        if (files.length)
            await productService.addProductImages(
                id,
                files.map((file) => normalizePath(file.path))
            );
        res.redirect("/admin/product/all");
    } catch (err) {
        console.log("Error, updateChosenProduct", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/product/all" });
    }
};

productController.removeProductImage = async (
    req: AdminRequest,
    res: Response
) => {
    try {
        console.log("removeProductImage");
        const id = parseObjectIdString(req.params.id);
        if (typeof req.body.image !== "string" || !req.body.image)
            throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_INPUT);

        await productService.removeProductImage(id, req.body.image);
        res.redirect("/admin/product/all");
    } catch (err) {
        console.log("Error, removeProductImage", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/product/all" });
    }
};

productController.removeChosenProduct = async (
    req: AdminRequest,
    res: Response
) => {
    try {
        console.log("removeChosenProduct");
        const id = parseObjectIdString(req.params.id);
        await productService.removeChosenProduct(id);
        res.redirect("/admin/product/all");
    } catch (err) {
        console.log("Error, removeChosenProduct", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/product/all" });
    }
};

export default productController;
