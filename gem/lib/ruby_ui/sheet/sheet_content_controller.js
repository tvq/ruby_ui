import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="ruby-ui--sheet-content" on the <dialog>; ruby-ui--sheet opens it.
export default class extends Controller {
  connect() {
    this.element.addEventListener("cancel", this.handleCancel);
    this.element.addEventListener("close", this.handleClose);
  }

  disconnect() {
    this.element.removeEventListener("cancel", this.handleCancel);
    this.element.removeEventListener("close", this.handleClose);
    // Nothing is left to wait for the exit animation, so apply the pending close now.
    this.settleExit(this.element);
    // Removed while open, the dialog fires no close event; the lock must not outlive it.
    this.releaseScrollLock();
  }

  close() {
    if (this.element.dataset.state === "closed") return;

    this.element.dataset.state = "closed";
    // The ::backdrop's animationend lands on the dialog too; panel and backdrop share one exit duration so either settles it.
    this.hideAfterExitAnimation(this.element);
  }

  afterExit() {
    this.element.close();
  }

  // A click on the ::backdrop targets the dialog, but so does one on the panel's own padding: hit-test the box.
  backdropClick(e) {
    if (e.target === this.element && !this.coversPoint(e.clientX, e.clientY)) this.close();
  }

  coversPoint(x, y) {
    const { top, right, bottom, left } = this.element.getBoundingClientRect();
    return left <= x && x <= right && top <= y && y <= bottom;
  }

  // Escape (and requestClose()) fire cancel; route it through the exit animation.
  handleCancel = (e) => {
    // A cancelled file picker inside the sheet bubbles its own cancel event.
    if (e.target !== this.element) return;

    e.preventDefault();
    this.close();
  };

  handleClose = () => {
    this.releaseScrollLock();
    // A close this controller did not start (a second Escape mid-exit) must not leave the exit listeners behind.
    this.settleExit(this.element);
  };

  // A nested Sheet or a Dialog may still be open underneath; the page stays locked for it.
  releaseScrollLock() {
    if (document.querySelector("dialog:modal")) return;

    document.body.classList.remove("overflow-hidden");
  }

  // Overlay exit — the same block in every overlay controller, so keep them in sync.
  exitAnimationNames = new WeakMap();

  hideAfterExitAnimation(animated) {
    const exitAnimations = animated
      .getAnimations()
      .filter((animation) => animation instanceof CSSAnimation);

    // No exit animation, or no box to run it in: animationend would never fire.
    if (exitAnimations.length === 0) {
      this.settleExit(animated);
      return;
    }

    this.exitAnimationNames.set(animated, exitAnimations.map((animation) => animation.animationName));
    animated.addEventListener("animationend", this.handleExitAnimationEnd);
    animated.addEventListener("animationcancel", this.handleExitAnimationEnd);
  }

  handleExitAnimationEnd = (event) => {
    // animationend bubbles — an animated child must not hide its container.
    if (event.target !== event.currentTarget) return;
    // Closing mid-open cancels the enter animation; only the exit run settles this.
    if (!this.exitAnimationNames.get(event.currentTarget)?.includes(event.animationName)) return;

    this.settleExit(event.currentTarget);
  };

  settleExit(animated) {
    animated.removeEventListener("animationend", this.handleExitAnimationEnd);
    animated.removeEventListener("animationcancel", this.handleExitAnimationEnd);
    // Reopened mid-exit: it is on its way back in, leave it visible.
    if (animated.dataset.state !== "closed") return;

    this.afterExit(animated);
  }
}
