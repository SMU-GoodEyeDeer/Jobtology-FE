// jsdom does not implement the native dialog lifecycle. Real focus containment
// and top-layer behavior are checked in the browser.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}
