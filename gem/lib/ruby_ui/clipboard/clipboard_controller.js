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

  onClickOutside(event) {
    if (this.element.contains(event.target)) return;

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

    this.closeWithExitAnimation(panel);
  }

  afterExit(panel) {
    const popover = panel === this.successPanelTarget ? this.successPopoverTarget : this.errorPopoverTarget;
    popover.classList.add("hidden");
  }

  // Overlay exit — the same block in every overlay controller, so keep them in sync.
  exitRuns = new WeakMap();

  closeWithExitAnimation(animated) {
    const running = new Set(animated.getAnimations());
    animated.dataset.state = "closed";
    // Only what the closed state started is the exit: not a cancelled enter, not an unrelated loop.
    const exitAnimations = animated.getAnimations().filter((animation) => !running.has(animation));

    // No exit animation, or no box to run it in: nothing would ever finish.
    if (exitAnimations.length === 0) {
      this.settleExit(animated);
      return;
    }

    this.exitRuns.set(animated, exitAnimations);
    // `finished` rejects when a run is cancelled, so this settles once every run is over either way.
    Promise.allSettled(exitAnimations.map((animation) => animation.finished)).then(() => {
      // Settled on disconnect meanwhile, or superseded by a newer close.
      if (this.exitRuns.get(animated) !== exitAnimations) return;

      this.settleExit(animated);
    });
  }

  settleExit(animated) {
    this.exitRuns.delete(animated);
    // Reopened mid-exit: it is on its way back in, leave it visible.
    if (animated.dataset.state !== "closed") return;

    this.afterExit(animated);
  }
}
