console.log("Kudo admin panel loaded");

/**
 * Modal dialogs are declared inline with `data-open-modal="<dialog id>"`.
 * The dialog itself stays inside whatever form it was rendered in, so its
 * fields submit with that form: the dialog's submit button saves the page,
 * while cancelling has to put the fields back the way it found them.
 */
const modalFields = function (dialog) {
    return Array.prototype.slice.call(
        dialog.querySelectorAll("input, select, textarea")
    );
};

const isToggle = function (field) {
    return field.type === "checkbox" || field.type === "radio";
};

const rememberModal = function (dialog) {
    modalFields(dialog).forEach(function (field) {
        if (isToggle(field)) field.dataset.originalChecked = field.checked ? "1" : "";
        else field.dataset.original = field.value;
    });
};

const revertModal = function (dialog) {
    modalFields(dialog).forEach(function (field) {
        if (isToggle(field)) {
            if (field.dataset.originalChecked !== undefined)
                field.checked = field.dataset.originalChecked === "1";
        } else if (field.dataset.original !== undefined) {
            field.value = field.dataset.original;
        }
    });
};

document.addEventListener("click", function (event) {
    const opener = event.target.closest("[data-open-modal]");
    if (opener) {
        const dialog = document.getElementById(opener.dataset.openModal);
        if (dialog && typeof dialog.showModal === "function") {
            rememberModal(dialog);
            dialog.showModal();
        }
        return;
    }

    const closer = event.target.closest("[data-close-modal]");
    if (closer) {
        const dialog = closer.closest("dialog");
        if (dialog) {
            revertModal(dialog);
            dialog.close();
        }
        return;
    }

    /* a click landing on the dialog itself is a click on its backdrop */
    if (event.target.tagName === "DIALOG") {
        revertModal(event.target);
        event.target.close();
    }
});

/* Escape closes a dialog natively, and counts as cancelling too */
document.addEventListener(
    "cancel",
    function (event) {
        if (event.target.tagName === "DIALOG") revertModal(event.target);
    },
    true
);
