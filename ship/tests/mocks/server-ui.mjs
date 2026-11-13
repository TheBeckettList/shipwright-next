// Scripted form answers: push numbers (button picks) or arrays (modal values).
// Records every field so tests can check form contents and signatures.
export const answers = [];
export const shown = [];
class Base {
  constructor() { this.fields = []; this._title = ""; this._body = ""; this._buttons = []; }
  title(t) { this._title = t; return this; }
  body(b) { this._body = b; return this; }
  button(b) { this._buttons.push(b); return this; }
  slider(label, min, max, opts) {
    if (typeof opts !== "object") throw new TypeError("slider expects an options object (server-ui 2.x)");
    if (!(max > min)) throw new Error(`slider ${label}: max must exceed min (${min}..${max})`);
    if (!Number.isInteger(opts.valueStep ?? 1) || !Number.isInteger(min) || !Number.isInteger(max))
      throw new Error(`slider ${label}: Bedrock sliders need whole numbers (got ${min}..${max} step ${opts.valueStep})`);
    this.fields.push({ type: "slider", label, min, max, opts }); return this;
  }
  dropdown(label, items, opts) { if (typeof opts !== "object") throw new TypeError("dropdown expects options object"); this.fields.push({ type: "dropdown", label, items }); return this; }
  toggle(label, opts) { if (typeof opts !== "object") throw new TypeError("toggle expects options object"); this.fields.push({ type: "toggle", label }); return this; }
  textField(label, ph, opts) { if (typeof opts !== "object") throw new TypeError("textField expects options object"); this.fields.push({ type: "text", label }); return this; }
  submitButton() { return this; }
  async show() {
    shown.push({ title: this._title, body: this._body, buttons: this._buttons, fields: this.fields });
    if (!answers.length) return { canceled: true };
    let a = answers.shift();
    // A string answer picks the button whose label starts with it (so tests needn't count buttons).
    if (typeof a === "string" && this._buttons) {
      const i = this._buttons.findIndex((b) => String(b?.text ?? b).startsWith(a));
      if (i < 0) throw new Error(`no button starting "${a}" in ${JSON.stringify(this._buttons)}`);
      a = i;
    }
    return Array.isArray(a) ? { canceled: false, formValues: a } : { canceled: false, selection: a };
  }
}
export class ActionFormData extends Base {}
export class ModalFormData extends Base {}
