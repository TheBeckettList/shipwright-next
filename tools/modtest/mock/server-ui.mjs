// inherency: instrument
// modtest's stand-in for @minecraft/server-ui: forms that are built and never shown.
class Form { constructor() { return new Proxy(this, { get: (t, k) => (k === "show" ? async () => ({ canceled: true }) : k === "then" ? undefined : () => t) }); } }
export class ActionFormData extends Form {}
export class ModalFormData extends Form {}
export class MessageFormData extends Form {}
