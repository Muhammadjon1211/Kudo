import ContactModel from "../schema/Contact.model";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Contact, ContactUpdateInput } from "../libs/types/contact";

/**
 * Contact is a singleton: exactly one settings document backs the website's
 * contact section, so there is no create/delete — only read and upsert.
 */
class ContactService {
    private readonly contactModel;

    constructor() {
        this.contactModel = ContactModel;
    }

    /** SPA */

    public async getContact(): Promise<Contact> {
        const result = await this.contactModel.findOne().exec();
        if (!result)
            throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

        return result.toJSON() as unknown as Contact;
    }

    /** SSR */

    public async getContactForAdmin(): Promise<Contact | null> {
        const result = await this.contactModel.findOne().exec();
        return result ? (result.toJSON() as unknown as Contact) : null;
    }

    public async updateContact(input: ContactUpdateInput): Promise<Contact> {
        try {
            const result = await this.contactModel
                .findOneAndUpdate({}, input, {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                })
                .exec();

            return result.toJSON() as unknown as Contact;
        } catch (err) {
            console.log("Error, model:updateContact:", err);
            throw new Errors(HttpCode.BAD_REQUEST, Message.UPDATE_FAILED);
        }
    }
}

export default ContactService;
