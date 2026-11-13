// All @minecraft/server-ui calls live here. Signatures follow server-ui 2.x
// (option objects for slider, dropdown, toggle, textField). If you target an
// older build, only this file needs to change.
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

/** Button menu. Buttons are text or { text, icon } (a texture path). Returns the chosen index, or -1 if closed. */
export async function menu(player, title, body, buttons) {
  const form = new ActionFormData().title(title).body(body);
  for (const b of buttons) {
    if (typeof b === "string") form.button(b);
    else if (b.icon) form.button(b.text, b.icon);
    else form.button(b.text);
  }
  const res = await form.show(player);
  return res.canceled ? -1 : res.selection;
}

/** Message with a single close button. */
export async function info(player, title, body) {
  await menu(player, title, body, ["Close"]);
}

/** Two-button confirm. Returns true only for the first button. */
export async function confirm(player, title, body, yes = "Confirm", no = "Cancel") {
  return (await menu(player, title, body, [yes, no])) === 0;
}

/**
 * Modal form. fields: array of
 *   { type: "slider", label, min, max, step, value }
 *   { type: "dropdown", label, options, index }
 *   { type: "toggle", label, value }
 *   { type: "text", label, placeholder, value }
 * Returns the values array, or null if closed.
 */
export async function modal(player, title, fields, submit = "Continue") {
  const form = new ModalFormData().title(title);
  for (const f of fields) {
    if (f.type === "slider") {
      form.slider(f.label, f.min, f.max, { valueStep: f.step ?? 1, defaultValue: f.value ?? f.min });
    } else if (f.type === "dropdown") {
      form.dropdown(f.label, f.options, { defaultValueIndex: f.index ?? 0 });
    } else if (f.type === "toggle") {
      form.toggle(f.label, { defaultValue: !!f.value });
    } else if (f.type === "text") {
      form.textField(f.label, f.placeholder ?? "", { defaultValue: f.value ?? "" });
    }
  }
  if (typeof form.submitButton === "function") form.submitButton(submit);
  const res = await form.show(player);
  return res.canceled ? null : res.formValues;
}
