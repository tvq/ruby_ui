import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="ruby-ui--alert-dialog"
export default class extends Controller {
  static targets = ["dialog"];
  static values = {
    open: {
      type: Boolean,
      default: false,
    },
  };

  connect() {
    this.dialogTarget.addEventListener("cancel", this.handleCancel);
    this.dialogTarget.addEventListener("close", this.handleClose);
    if (this.openValue) {
      this.open();
    }
  }

  disconnect() {
    this.dialogTarget.removeEventListener("cancel", this.handleCancel);
    this.dialogTarget.removeEventListener("close", this.handleClose);
    // Nothing is left to wait for the exit animation, so apply the pending close now.
    this.settleExit(this.dialogTarget);
    document.body.classList.remove("overflow-hidden");
  }

  open() {
    this.dialogTarget.dataset.state = "open";
    if (!this.dialogTarget.open) this.dialogTarget.showModal();
    document.body.classList.add("overflow-hidden");
  }

  dismiss() {
    if (this.dialogTarget.dataset.state === "closed") return;

    this.dialogTarget.dataset.state = "closed";
    // The backdrop's animationend lands on this element under the same name, so both exits run for the same 200 ms.
    this.hideAfterExitAnimation(this.dialogTarget);
  }

  afterExit() {
    this.dialogTarget.close();
  }

  // Escape (and requestClose) must play the exit animation instead of closing at once.
  handleCancel = (event) => {
    event.preventDefault();
    this.dismiss();
  };

  // A close this controller did not start must not leave the exit listeners behind.
  handleClose = () => {
    document.body.classList.remove("overflow-hidden");
    this.settleExit(this.dialogTarget);
  };

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
