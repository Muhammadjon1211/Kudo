# Backend Architecture Prompt (copy-paste into an LLM)

> Give the LLM everything between the `===` markers. Replace the domain
> entities in section 9 with the ones your new project needs.

===============================================================================

## ROLE

You are building the backend of a new project. Follow the architecture below
**exactly**. It is a layered MVC-style Express + TypeScript + Mongoose backend
that serves **two client surfaces from one codebase**. Do not substitute your
own preferred patterns (no NestJS, no Prisma, no repository pattern, no
`express.Router()` per feature file, no DTO validation libraries) unless I
explicitly ask.

## 1. STACK

- Runtime: Node.js, **CommonJS** (`"type": "commonjs"` in package.json)
- Language: TypeScript, `strict: true`, target ES2020, `module`/`moduleResolution`: NodeNext
- Framework: Express 4
- DB: MongoDB via Mongoose 6
- Dev: `ts-node` + `nodemon`, no build step in dev
- Auth: **JWT in a cookie** for the API surface, **express-session +
  connect-mongodb-session** for the server-rendered surface
- Other: `bcryptjs` (hashing), `multer` + `uuid` (uploads), `morgan` (logging),
  `cors`, `cookie-parser`, `dotenv`, `ejs` (SSR views)

Scripts:
```json
"start":     "ts-node src/server.ts",
"start:dev": "nodemon --exec ts-node src/server.ts",
"build":     "tsc"
```
`tsconfig.json`: `rootDir: ./src`, `outDir: ./dist`, `include: ["src/**/*.ts"]`.

## 2. DIRECTORY LAYOUT

Create exactly this shape. Folder names and file-name suffixes are part of the
convention — do not rename them.

```
src/
  server.ts               # boot: dotenv → mongoose.connect → app.listen
  app.ts                  # the Express instance: middleware, sessions, views, routers
  router.ts               # API surface routes  (JSON / SPA client)
  router-admin.ts         # SSR surface routes  (EJS admin panel)
  controllers/
    <entity>.controller.ts
  models/                 # SERVICE layer (business logic). NOT mongoose schemas.
    <Entity>.service.ts
    Auth.service.ts
  schema/                 # MONGOOSE layer (schemas + models)
    <Entity>.model.ts
  libs/
    config.ts             # shared constants + shared helpers
    Errors.ts             # Errors class + HttpCode enum + Message enum
    types/
      common.ts           # export interface T { [key: string]: any }
      <entity>.ts         # Entity / EntityInput / EntityUpdateInput / EntityInquiry
    enums/
      <entity>.enum.ts    # status/type enums, reused by schema AND types
    utils/
      uploader.ts         # multer factory
  views/                  # .ejs templates, + views/includes/{header,footer}.ejs
  public/                 # css/, js/, img/  — served statically
uploads/                  # runtime upload target, one subfolder per entity
```

**Critical naming rule:** `models/` holds `*.service.ts` (the business logic
that the MVC "Model" role owns) and `schema/` holds `*.model.ts` (the Mongoose
schema/DB mapping). This split is intentional. Keep it.

## 3. BOOTSTRAP LAYER

`src/server.ts` — the only file that reads `.env` and opens ports:

```ts
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import app from "./app";

mongoose
  .connect(process.env.MONGO_URL as string, {})
  .then(() => {
    console.log("MongoDB connection SUCCEED");
    const PORT = process.env.PORT ?? 3003;
    app.listen(PORT, function () {
      console.info(`Our server successfully running on PORT ${PORT}`);
      console.info(`Admin project on http://localhost:${PORT}/admin \n`);
    });
  })
  .catch((err) => console.log("ERROR on connection MongoDB", err));
```

Nothing serves traffic until Mongo connects. `app.listen` lives **inside**
`.then()`.

`src/app.ts` — exports the configured Express app, in this fixed order with
these section comments:

```
/* 1-ENTRANCE */   express.static(public), "/uploads" static, urlencoded,
                   json, cors({credentials:true, origin:true}), cookieParser,
                   morgan(MORGAN_FORMAT)
/* 2-SESSIONS */   session({ secret, cookie:{maxAge}, store: MongoDBStore,
                   resave:true, saveUninitialized:true })
                   + a middleware that copies req.session.member into
                     res.locals.member so EJS templates can read it
/* 3-VIEWS  */     app.set("views", path.join(__dirname,"views"));
                   app.set("view engine","ejs")
/* 4-ROUTES */     app.use("/admin", routerAdmin);   // SSR, mounted FIRST
                   app.use("/", router);             // API, mounted LAST
export default app;
```

The session store is MongoDB-backed:
```ts
const MongoDBStore = ConnectMongoDB(session);
const store = new MongoDBStore({ uri: String(process.env.MONGO_URL), collection: "sessions" });
```

`.env` keys: `PORT`, `MONGO_URL`, `SESSION_SECRET`, `SECRET_TOKEN`.

## 4. ROUTER LAYER

Two flat router files at `src/` root — **not** per-feature route modules.
Routers contain zero logic: they are lookup tables of
`method + path → [middleware...] → controller.handler`, grouped by
`/** Entity **/` comment blocks.

`router.ts` (API, JSON):
```ts
const router = express.Router();

/** Member **/
router.post("/member/signup", memberController.signup);
router.post("/member/login", memberController.login);
router.post("/member/logout", memberController.verifyAuth, memberController.logout);
router.get("/member/detail", memberController.verifyAuth, memberController.getMemberDetail);
router.post(
  "/member/update",
  memberController.verifyAuth,
  uploader("members").single("memberImage"),
  memberController.updateMember
);

/** Product **/
router.get("/product/all", productController.getProducts);
router.get("/product/:id", memberController.retrieveAuth, productController.getProduct);

export default router;
```

Path convention: `/<entity>/<action>` — `all`, `create`, `update`, `detail`,
`:id`. Auth middleware is applied **per route**, never globally.

`router-admin.ts` (SSR) uses chained `.get()/.post()` pairs for form pages and
guards writes with `restaurantController.verifyRestaurant`:
```ts
routerAdmin
  .get("/login", restaurantController.getLogin)
  .post("/login", restaurantController.processLogin);

routerAdmin.get("/product/all", restaurantController.verifyRestaurant, productController.getAllProducts);
```

## 5. CONTROLLER LAYER

Controllers are **plain objects typed `T`**, not classes, with handlers assigned
as properties. Service instances are constructed once at module load.

```ts
import { T } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import MemberService from "../models/Member.service";

const memberService = new MemberService();
const memberController: T = {};

memberController.getMemberDetail = async (req: ExtendedRequest, res: Response) => {
  try {
    console.log("getMemberDetail");                       // 1. log the handler name
    const result = await memberService.getMemberDetail(req.member);  // 2. delegate
    res.status(HttpCode.OK).json(result);                  // 3. respond
  } catch (err) {
    console.log("Error, getMemberDetail", err);
    if (err instanceof Errors) res.status(err.code).json(err);
    else res.status(Errors.standard.code).json(Errors.standard);
  }
};

export default memberController;
```

Every API handler follows that 3-step body and that **exact** catch block —
this is the project's error contract, repeated per handler. There is no global
Express error middleware.

Controller responsibilities, and nothing more:
- pull data off the request: `req.body`, `req.query`, `req.params`, `req.file(s)`
- coerce primitives only (e.g. build an `Inquiry` object by `Number(page)` and
  casting `status as OrderStatus`)
- attach upload paths: `if (req.file) input.image = req.file.path.replace(/\\/, "/")`
- call exactly one service method
- send the response

No DB access, no business rules, no bcrypt/jwt calls in controllers.

**SSR controllers differ deliberately.** They render or redirect, and report
errors as an inline script so the browser gets an alert:
```ts
res.render("users", { users: result });
// or
req.session.member = result;
req.session.save(function () { res.redirect("/admin/product/all"); });
// error path:
const message = err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
res.send(`<script> alert("Hi, ${message}"); window.location.replace("/admin/login")</script>`);
```
Note the SSR session write pattern: assign `req.session.member`, then redirect
**inside** `req.session.save()` so the store write completes first.

## 6. SERVICE LAYER (`src/models/*.service.ts`)

One **class** per entity, default-exported. Mongoose models and peer services
are held as `private readonly` fields assigned in the constructor:

```ts
class OrderService {
  private readonly orderModel;
  private readonly orderItemModel;
  private readonly memberService;

  constructor() {
    this.orderModel = OrderModel;
    this.orderItemModel = OrderItemModel;
    this.memberService = new MemberService();   // services may compose services
  }
```

Rules:
- All public methods are `async` and have an explicit return type:
  `Promise<Order>`, `Promise<Order[]>`, `Promise<void>`.
- Methods are grouped by surface with `/** SPA */` and `/** SSR */` comment
  banners inside the same class. The SSR variants get distinct names
  (`signup`/`processSignup`, `login`/`processLogin`, `getProducts`/`getAllProducts`).
- The service is the **only** layer that touches `this.<x>Model`.
- Business rules live here: hashing, uniqueness checks, points/rewards,
  view-count increments, delivery-fee math.
- Failure = `throw new Errors(HttpCode.X, Message.Y)`. Never return `null` to
  signal failure and never send a response.
- Wrap `.create()` in try/catch and rethrow as a domain error:
  ```ts
  try { return await this.productModel.create(input); }
  catch (err) { console.log("Error, model:createNewProduct:", err);
                throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED); }
  ```
- Convert incoming ids with the shared helper before querying:
  `const memberId = shapeIntoMongooseObjectId(member._id);`
- Private helpers for multi-document writes, e.g.
  `private async recordOrderItem(orderId, input): Promise<void>` which maps
  inputs to `create()` promises and awaits `Promise.all(...)`.

**Paginated list queries use an aggregation pipeline**, built in this order:
```ts
const match: T = { productStatus: ProductStatus.PROCESS };
if (inquiry.productCollection) match.productCollection = inquiry.productCollection;
if (inquiry.search) match.productName = { $regex: new RegExp(inquiry.search, "i") };

const sort: T = inquiry.order === "productPrice"
  ? { [inquiry.order]: 1 }
  : { [inquiry.order]: -1 };

return await this.productModel.aggregate([
  { $match: match },
  { $sort: sort },
  { $skip: (inquiry.page * 1 - 1) * inquiry.limit },
  { $limit: inquiry.limit * 1 },
  // joins, when the response needs related docs:
  { $lookup: { from: "orderItems", localField: "_id", foreignField: "orderId", as: "orderItems" } },
  { $lookup: { from: "products", localField: "orderItems.productId", foreignField: "_id", as: "productData" } },
]).exec();
```
Joined-in fields are declared on the entity interface under a
`/* from aggregations */` comment.

## 7. SCHEMA LAYER (`src/schema/*.model.ts`)

One schema per file, default-exporting the compiled model. TS enums drive the
schema enums, so status values have exactly one source of truth.

```ts
const memberSchema = new Schema(
  {
    memberType:     { type: String, enum: MemberType,   default: MemberType.USER },
    memberStatus:   { type: String, enum: MemberStatus, default: MemberStatus.ACTIVE },
    memberNick:     { type: String, index: { unique: true, sparse: true }, required: true },
    memberPassword: { type: String, select: false, required: true },
    memberPoints:   { type: Number, default: 0 },
    memberImage:    { type: String },
  },
  { timestamps: true }
);
export default mongoose.model("Member", memberSchema);
```

Conventions:
- **Fields are prefixed with the entity name** (`memberNick`, `productPrice`,
  `orderTotal`, `itemQuantity`, `viewGroup`). Keep this — it is the most visible
  convention in the codebase.
- `{ timestamps: true }` on every schema; add an explicit
  `collection: "orders"` when the pluralized default isn't what `$lookup`
  targets expect.
- Relations are `{ type: Schema.Types.ObjectId, ref: "Entity" }`.
- Secrets use `select: false`; the service must project them explicitly to read
  them (`findOne(filter, { memberNick: 1, memberPassword: 1 })`).
- Uniqueness via `index: { unique: true, sparse: true }`.

## 8. SHARED LIBS

`libs/Errors.ts` — the whole error system:
```ts
export enum HttpCode { OK = 200, CREATED = 201, BAD_REQUEST = 400,
  UNAUTHORIZED = 401, FORBIDDEN = 403, NOT_FOUND = 404,
  NOT_MODIFIED = 304, INTERNAL_SERVER_ERROR = 500 }

export enum Message {
  SOMETHING_WENT_WRONG = "Something went wrong!",
  NO_DATA_FOUND = "No data is found!",
  CREATE_FAILED = "Create is failed!",
  UPDATE_FAILED = "Update is failed!",
  // ...then domain-specific messages
}

class Errors extends Error {
  public code: HttpCode;
  public message: Message;
  static standard = { code: HttpCode.INTERNAL_SERVER_ERROR,
                      message: Message.SOMETHING_WENT_WRONG };
  constructor(statusCode: HttpCode, statusMessage: Message) {
    super(); this.code = statusCode; this.message = statusMessage;
  }
}
export default Errors;
```
All user-facing strings are `Message` enum members — never inline string
literals in a throw.

`libs/config.ts` — constants plus the ObjectId helper:
```ts
export const MORGAN_FORMAT = ":method :url :response-time[:status] \n";
export const AUTH_TIMER = 24;   // hours; used for both JWT expiry and cookie maxAge
export const shapeIntoMongooseObjectId = (target: any) =>
  typeof target === "string" ? new mongoose.Types.ObjectId(target) : target;
```

`libs/types/common.ts` — `export interface T { [key: string]: any }`. Used for
controller objects and for dynamically-built aggregation `match`/`sort` objects.

`libs/types/<entity>.ts` — **four interfaces per entity**, always in this shape:
- `Entity` — the full document: `_id`, all fields, `createdAt`, `updatedAt`
- `EntityInput` — create payload; server-defaulted fields optional
- `EntityUpdateInput` — update payload; `_id` required, everything else optional
- `EntityInquiry` — list-query params: `page`, `limit`, plus `order`/`search`/status filters

Request augmentation types live in the member/user types file:
```ts
export interface ExtendedRequest extends Request {   // API surface
  member: Member;
  file: Express.Multer.File;
  files: Express.Multer.File[];
}
export interface AdminRequest extends Request {      // SSR surface
  member: Member;
  session: Session & { member: Member };
  file: Express.Multer.File;
  files: Express.Multer.File[];
}
```

`libs/utils/uploader.ts` — a **multer factory** keyed by destination folder,
default-exported, so routes declare their own upload target:
```ts
const makeUploader = (address: string) =>
  multer({ storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, `./uploads/${address}`),
    filename: (req, file, cb) => cb(null, v4() + path.parse(file.originalname).ext),
  })});
export default makeUploader;
```
Used in routers as `uploader("members").single("memberImage")` or
`makeUploader("products").array("productImages", 5)`. Files are stored with
UUID names; the DB stores the relative path string.

## 9. AUTH: TWO INDEPENDENT MECHANISMS

**API surface — JWT in a cookie.** `models/Auth.service.ts` owns tokens only:
```ts
class AuthService {
  private readonly secretToken;
  constructor() { this.secretToken = process.env.SECRET_TOKEN as string; }

  public async createToken(payload: Member): Promise<string> { /* jwt.sign, expiresIn `${AUTH_TIMER}h` */ }
  public async checkAuth(token: string): Promise<Member>     { /* jwt.verify → Member */ }
}
```
On signup/login the controller sets the cookie and returns both:
```ts
res.cookie("accessToken", token, { maxAge: AUTH_TIMER * 3600 * 1000, httpOnly: false });
res.status(HttpCode.OK).json({ member: result, accessToken: token });
```
Logout overwrites it with `{ maxAge: 0 }`.

Two guards, both defined on the member controller:
- `verifyAuth` — **required** auth: reads `req.cookies["accessToken"]`, sets
  `req.member`, throws `UNAUTHORIZED / NOT_AUTHENTICATED` if absent, else `next()`
- `retrieveAuth` — **optional** auth: sets `req.member` if a valid token exists,
  and always calls `next()` (used where a logged-in user gets extra behavior,
  e.g. recording a product view, but guests are still allowed)

**SSR surface — session.** `verifyRestaurant` on the SSR controller checks
`req.session?.member?.memberType === MemberType.RESTAURANT`, copies it to
`req.member`, and otherwise responds with the alert-and-redirect script.

## 10. ENTITIES TO BUILD

<<< REPLACE THIS SECTION with your domain. For each entity, deliver the full
vertical slice in this order:
  1. libs/enums/<entity>.enum.ts
  2. libs/types/<entity>.ts        (4 interfaces)
  3. schema/<Entity>.model.ts
  4. models/<Entity>.service.ts
  5. controllers/<entity>.controller.ts
  6. routes in router.ts and/or router-admin.ts
  7. new Message members in libs/Errors.ts for its failure cases
Build one entity end-to-end before starting the next, and commit per entity
with `feat: develop <action> REST API`. >>>

Reference entity set from the source project (a food-ordering backend), showing
the intended relationship density:
- **Member** — `memberType: USER | RESTAURANT`, `memberStatus: ACTIVE | BLOCK |
  DELETE`, nick/phone/password/address/desc/image/points. Serves both surfaces
  from one collection; the RESTAURANT member is the admin, and signup enforces
  that only one may exist.
- **Product** — status/collection/size enums, price, leftCount, volume, images[], views
- **Order** + **OrderItem** — order holds totals and `memberId`; items hold
  quantity/price/`orderId`/`productId`. Creating an order computes
  `orderTotal = sum(price*qty) + delivery` (delivery = 5 if subtotal < 100 else
  0), inserts the order, then bulk-inserts items. Reading orders `$lookup`s
  items and products. Moving an order to PROCESS awards the member a point via
  `MemberService.addUserPoint`.
- **View** — dedupe table of `{ memberId, viewRefId, viewGroup }` so a product's
  view count increments once per member.

## 11. CODE STYLE

- 4-space indent, double-quoted strings, semicolons.
- `console.log("<handlerName>")` at the top of each controller handler;
  `console.log("Error, <handlerName>", err)` in each catch.
- Service-layer error logs are tagged `"Error, model:<methodName>:"`.
- Keep comment banners: `/** SPA */`, `/** SSR */`, `/** Member **/`,
  `/* 1-ENTRANCE */`.
- Explicit return types on all service methods.
- Comma-chained `const` declarations are used in controllers and are fine:
  ```ts
  const input: LoginInput = req.body,
    result = await memberService.login(input),
    token = await authService.createToken(result);
  ```

## 12. FIX THESE IN THE NEW PROJECT

The reference implementation has real defects. Follow its structure, not these:

1. `HttpCode.NOT_MODIFIED` was `404` (a duplicate of `NOT_FOUND`); 304 is also
   the wrong status for a failed write. Use `HttpCode.BAD_REQUEST` for failed
   updates, or add `CONFLICT = 409`.
2. Never mutate a query result before the null check (`result.target = "Test"`
   ran before `if (!result)`, which crashes on empty).
3. `findByIdAndUpdate({ memberId, _id: orderId }, ...)` is wrong — that first
   argument is treated as an id, so the ownership filter is silently ignored.
   Use `findOneAndUpdate({ _id: orderId, memberId }, ...)` whenever a write must
   be scoped to its owner.
4. Add input validation at the controller boundary (reject `NaN` page/limit,
   validate enum values, require non-empty bodies). The reference project has
   none, so `Number(undefined)` reaches `$skip`.
5. `httpOnly: false` on the auth cookie exposes the JWT to any script on the
   page. Use `httpOnly: true` plus `secure` and `sameSite` in production.
6. `saveUninitialized: true` writes a session document for every anonymous
   visitor. Prefer `false`.
7. Multi-document writes (order + its items) aren't transactional — a failure
   mid-way leaves an order with no items. Use a Mongoose session/transaction, or
   at minimum clean up on failure.
8. Don't leave stray editor-inserted imports (`node:vm`, `node:console`,
   `node:http2` appear unused in several services).
9. Typing controllers as `T` (`{[key:string]: any}`) removes all type checking
   from the layer that handles untrusted input. Prefer typed handler signatures
   (`RequestHandler`) even while keeping the object-literal controller shape.
10. Interpolating values into `res.send("<script>alert(...)")` is an XSS sink.
    Escape, or render an EJS error view instead.
11. Add a global Express error handler and a 404 handler as a backstop; keep the
    per-handler catches for domain errors.
12. Watch spelling in shared identifiers — the reference has
    `Message.SOMETHING__WENT_WRONG` (double underscore), `orderStaus` in the
    `Order` interface vs `orderStatus` in the schema (so the typed field never
    matches the stored one), and `restaurant.contoller.ts`. Typos in a schema
    field or enum member become silent data bugs.

===============================================================================

## Notes for the human using this prompt

- **Sections 2, 5, 6, 7 are the load-bearing ones.** If you trim the prompt for
  a smaller context window, keep the directory layout, the
  `models/`-vs-`schema/` split, the controller-object shape with its catch
  block, and the service-class shape.
- If your new project has no admin panel, delete every SSR mention
  (`router-admin.ts`, `views/`, `AdminRequest`, sessions, `verifyRestaurant`,
  the `/** SSR */` service banners) and keep the JWT half. The layering is
  unchanged.
- Section 12 is deliberately separate: sections 1–11 describe the structure to
  copy, section 12 lists what not to copy. Keep both — dropping 12 means the
  LLM faithfully reproduces the bugs too.
