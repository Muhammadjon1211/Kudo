import express from "express";
import memberController from "./controllers/member.controller";
import productController from "./controllers/product.controller";
import blogController from "./controllers/blog.controller";
import contactController from "./controllers/contact.controller";
import orderController from "./controllers/order.controller";
import makeUploader from "./libs/utils/uploader";

const router = express.Router();

/** Member **/
router.post("/member/signup", memberController.signup);
router.post("/member/login", memberController.login);
router.post("/member/logout", memberController.verifyAuth, memberController.logout);
router.get("/member/top-students", memberController.getTopStudents);
router.get(
    "/member/detail",
    memberController.verifyAuth,
    memberController.getMemberDetail
);
router.post(
    "/member/update",
    memberController.verifyAuth,
    makeUploader("members").single("memberImage"),
    memberController.updateMember
);

/** Product **/
router.get("/product/all", productController.getProducts);
router.get("/product/:id", memberController.retrieveAuth, productController.getProduct);

/** Blog **/
router.get("/blog/all", memberController.retrieveAuth, blogController.getBlogs);
router.post("/blog/like", memberController.verifyAuth, blogController.likeBlog);
router.get("/blog/:id", memberController.retrieveAuth, blogController.getBlog);

/** Contact **/
router.get("/contact", contactController.getContact);

/** Order **/
router.post("/order/create", memberController.verifyAuth, orderController.createOrder);
router.get("/order/all", memberController.verifyAuth, orderController.getMyOrders);
router.post("/order/update", memberController.verifyAuth, orderController.updateOrder);

export default router;
