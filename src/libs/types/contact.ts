import { ObjectId } from "mongoose";

export interface ContactSocials {
    instagram?: string;
    telegram?: string;
    facebook?: string;
    youtube?: string;
}

export interface Contact {
    _id: ObjectId;
    contactPhone: string;
    contactEmail: string;
    contactAddress: string;
    contactMapUrl?: string;
    contactWorkHours?: string;
    contactSocials: ContactSocials;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContactInput {
    contactPhone: string;
    contactEmail: string;
    contactAddress: string;
    contactMapUrl?: string;
    contactWorkHours?: string;
    contactSocials?: ContactSocials;
}

/**
 * Contact is a singleton settings document: the admin edits the one record in
 * place, so the update payload carries no `_id` and every field is optional.
 */
export interface ContactUpdateInput {
    contactPhone?: string;
    contactEmail?: string;
    contactAddress?: string;
    contactMapUrl?: string;
    contactWorkHours?: string;
    contactSocials?: ContactSocials;
}
