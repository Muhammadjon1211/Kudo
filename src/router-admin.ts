import express from "express";
import adminController from "./controllers/admin.controller";
import productController from "./controllers/product.controller";
import blogController from "./controllers/blog.controller";
import contactController from "./controllers/contact.controller";
import orderController from "./controllers/order.controller";
import makeUploader from "./libs/utils/uploader";
import { verifyCsrf } from "./libs/utils/csrf";

const routerAdmin = express.Router();

/* verifyCsrf sits after any uploader: multer is what fills req.body */

/** Session **/
routerAdmin.get("/", adminController.goHome);
routerAdmin
    .get("/login", adminController.getLogin)
    .post("/login", verifyCsrf, adminController.processLogin);
routerAdmin
    .get("/signup", adminController.getSignup)
    .post("/signup", verifyCsrf, adminController.processSignup);
routerAdmin.get("/logout", adminController.verifyAdmin, adminController.logout);
routerAdmin.get("/check-me", adminController.checkAuthSession);

/** Profile **/
routerAdmin
    .get("/profile", adminController.verifyAdmin, adminController.getProfile)
    .post(
        "/profile",
        adminController.verifyAdmin,
        verifyCsrf,
        adminController.updateProfile
    );
routerAdmin.post(
    "/profile/password",
    adminController.verifyAdmin,
    verifyCsrf,
    adminController.changePassword
);

/** Users **/
routerAdmin.get("/user/all", adminController.verifyAdmin, adminController.getUsers);
routerAdmin.post(
    "/user/create",
    adminController.verifyAdmin,
    verifyCsrf,
    adminController.createMember
);
routerAdmin.post(
    "/user/edit/:id",
    adminController.verifyAdmin,
    verifyCsrf,
    adminController.updateChosenUser
);
/* the users table is saved in one go, every rendered row at once */
routerAdmin.post(
    "/user/edit-all",
    adminController.verifyAdmin,
    verifyCsrf,
    adminController.updateUsers
);
routerAdmin.post(
    "/user/delete/:id",
    adminController.verifyAdmin,
    verifyCsrf,
    adminController.removeChosenUser
);

/** Products **/
routerAdmin.get(
    "/product/all",
    adminController.verifyAdmin,
    productController.getAllProducts
);
routerAdmin.post(
    "/product/create",
    adminController.verifyAdmin,
    makeUploader("products").array("productImages", 5),
    verifyCsrf,
    productController.createNewProduct
);
routerAdmin.post(
    "/product/edit/:id",
    adminController.verifyAdmin,
    makeUploader("products").array("productImages", 5),
    verifyCsrf,
    productController.updateChosenProduct
);
routerAdmin.post(
    "/product/image/remove/:id",
    adminController.verifyAdmin,
    verifyCsrf,
    productController.removeProductImage
);
routerAdmin.post(
    "/product/delete/:id",
    adminController.verifyAdmin,
    verifyCsrf,
    productController.removeChosenProduct
);

/** Blogs **/
routerAdmin.get("/blog/all", adminController.verifyAdmin, blogController.getAllBlogs);
routerAdmin.get(
    "/blog/edit/:id",
    adminController.verifyAdmin,
    blogController.getChosenBlog
);
routerAdmin.post(
    "/blog/create",
    adminController.verifyAdmin,
    makeUploader("blogs").single("blogImage"),
    verifyCsrf,
    blogController.createNewBlog
);
routerAdmin.post(
    "/blog/edit/:id",
    adminController.verifyAdmin,
    makeUploader("blogs").single("blogImage"),
    verifyCsrf,
    blogController.updateChosenBlog
);
routerAdmin.post(
    "/blog/delete/:id",
    adminController.verifyAdmin,
    verifyCsrf,
    blogController.removeChosenBlog
);

/** Contact **/
routerAdmin
    .get("/contact", adminController.verifyAdmin, contactController.getContactPage)
    .post(
        "/contact",
        adminController.verifyAdmin,
        verifyCsrf,
        contactController.updateContact
    );

/** Orders **/
routerAdmin.get("/order/all", adminController.verifyAdmin, orderController.getAllOrders);
routerAdmin.post(
    "/order/edit/:id",
    adminController.verifyAdmin,
    verifyCsrf,
    orderController.updateChosenOrder
);

export default routerAdmin;
