import { Request, Response } from "express";
import { Controller } from "../libs/types/common";
import Errors, { HttpCode, Message } from "../libs/Errors";
import ContactService from "../models/Contact.service";
import { ContactUpdateInput } from "../libs/types/contact";
import { AdminRequest } from "../libs/types/member";
import { requireBody } from "../libs/utils/validate";

const contactService = new ContactService();
const contactController: Controller = {};

/** SPA */

contactController.getContact = async (req: Request, res: Response) => {
    try {
        console.log("getContact");
        const result = await contactService.getContact();
        res.status(HttpCode.OK).json(result);
    } catch (err) {
        console.log("Error, getContact", err);
        if (err instanceof Errors) res.status(err.code).json(err);
        else res.status(Errors.standard.code).json(Errors.standard);
    }
};

/** SSR */

contactController.getContactPage = async (req: Request, res: Response) => {
    try {
        console.log("getContactPage");
        const result = await contactService.getContactForAdmin();
        res.render("contact", { contact: result });
    } catch (err) {
        console.log("Error, getContactPage", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin" });
    }
};

contactController.updateContact = async (req: AdminRequest, res: Response) => {
    try {
        console.log("updateContact");
        requireBody(req.body);
        const input: ContactUpdateInput = {
            contactPhone: req.body.contactPhone,
            contactEmail: req.body.contactEmail,
            contactAddress: req.body.contactAddress,
            contactMapUrl: req.body.contactMapUrl,
            contactWorkHours: req.body.contactWorkHours,
            contactSocials: {
                instagram: req.body.instagram,
                telegram: req.body.telegram,
                facebook: req.body.facebook,
                youtube: req.body.youtube,
            },
        };

        await contactService.updateContact(input);
        res.redirect("/admin/contact");
    } catch (err) {
        console.log("Error, updateContact", err);
        const message =
            err instanceof Errors ? err.message : Message.SOMETHING_WENT_WRONG;
        res.render("error", { message: message, redirect: "/admin/contact" });
    }
};

export default contactController;
