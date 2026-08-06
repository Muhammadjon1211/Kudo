/**
 * Flattens a Mongoose document into plain JSON.
 *
 * The session store ships its own bson version, which rejects ObjectId
 * instances created by Mongoose's bson ("Unsupported BSON version"). Anything
 * written to req.session must therefore be plain JSON: ids become strings,
 * which shapeIntoMongooseObjectId converts back on the way into a query.
 */
export const toPlainJSON = <R>(value: R): R => JSON.parse(JSON.stringify(value));
