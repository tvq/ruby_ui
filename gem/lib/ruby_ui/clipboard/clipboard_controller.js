import { Controller } from "@hotwired/stimulus"
import { computePosition, flip, shift } from "@floating-ui/dom";

// Connects to data-controller="accordion"
export default class extends Controller {
  static targets = ['trigger', 'source', 'successPopover', 'successPanel', 'errorPopover', 'errorPanel']
  static values = {
    options: {
      type: Object,
      default: {},
    },
  }

  disconnect() {
    // Nothing is left to wait for the exit animation, so apply the pending hide now.
    if (this.hasSuccessPanelTarget) this.settleExit(this.successPanelTarget);
    if (this.hasErrorPanelTarget) this.settleExit(this.errorPanelTarget);
  }

  copy() {
    let sourceElement = this.sourceTarget.children[0];
    if (!sourceElement) {
      this.#showErrorPopover();
      return;
    }
    let textToCopy = sourceElement.tagName === 'INPUT' ? sourceElement.value : sourceElement.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      this.#showSuccessPopover();
    }).catch(() => {
      this.#showErrorPopover();
    })
  }

  onClickOutside() {
    this.#hidePopover(this.successPopoverTarget, this.successPanelTarget);
    this.#hidePopover(this.errorPopoverTarget, this.errorPanelTarget);
  }

  #computeTooltip(popoverElement) {
    computePosition(this.triggerTarget, popoverElement, {
      placement: this.optionsValue.placement || "top",
      middleware: [flip(), shift()],
    }).then(({ x, y }) => {
      Object.assign(popoverElement.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }

  #showSuccessPopover() {
    this.#showPopover(this.successPopoverTarget, this.successPanelTarget);
  }

  #showErrorPopover() {
    this.#showPopover(this.errorPopoverTarget, this.errorPanelTarget);
  }

  #showPopover(popover, panel) {
    this.#computeTooltip(popover);
    popover.classList.remove("hidden");
    panel.dataset.state = "open";
  }

  #hidePopover(popover, panel) {
    if (popover.classList.contains("hidden")) return;

    panel.dataset.state = "closed";
    this.hideAfterExitAnimation(panel);
  }

  afterExit(panel) {
    const popover = panel === this.successPanelTarget ? this.successPopoverTarget : this.errorPopoverTarget;
    popover.classList.add("hidden");
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
