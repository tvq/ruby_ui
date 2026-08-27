import { Controller } from "@hotwired/stimulus";
import { computePosition, autoUpdate, offset, flip } from "@floating-ui/dom";

export default class extends Controller {
  static targets = ["trigger", "content", "panel", "input", "value", "item"];
  static values = { open: Boolean };
  static outlets = ["ruby-ui--select-item"];

  constructor(...args) {
    super(...args);
    this.cleanup;
  }

  connect() {
    this.setFloatingElement();
    this.generateItemsIds();
  }

  disconnect() {
    // Nothing is left to wait for the exit animation, so apply the pending hide now.
    if (this.hasPanelTarget) this.settleExit(this.panelTarget);
    this.cleanup();
  }

  selectItem(event) {
    event.preventDefault();

    this.rubyUiSelectItemOutlets.forEach((item) =>
      item.handleSelectItem(event),
    );

    const oldValue = this.inputTarget.value;
    const newValue = event.target.dataset.value;

    this.inputTarget.value = newValue;
    this.valueTarget.innerText = event.target.innerText;

    this.dispatchOnChange(oldValue, newValue);
    this.closeContent();
  }

  onClick() {
    this.toogleContent();

    if (this.openValue) {
      this.setFocusAndCurrent();
    } else {
      this.resetCurrent();
    }
  }

  handleKeyDown(event) {
    event.preventDefault();

    const currentIndex = this.itemTargets.findIndex(
      (item) => item.getAttribute("aria-current") === "true",
    );

    if (currentIndex + 1 < this.itemTargets.length) {
      this.itemTargets[currentIndex].removeAttribute("aria-current");
      this.setAriaCurrentAndActiveDescendant(currentIndex + 1);
    }
  }

  handleKeyUp(event) {
    event.preventDefault();

    const currentIndex = this.itemTargets.findIndex(
      (item) => item.getAttribute("aria-current") === "true",
    );

    if (currentIndex > 0) {
      this.itemTargets[currentIndex].removeAttribute("aria-current");
      this.setAriaCurrentAndActiveDescendant(currentIndex - 1);
    }
  }

  handleEsc(event) {
    event.preventDefault();
    this.closeContent();
  }

  setFocusAndCurrent() {
    const selectedItem = this.itemTargets.find(
      (item) => item.getAttribute("aria-selected") === "true",
    );

    if (selectedItem) {
      selectedItem.focus({ preventScroll: true });
      selectedItem.setAttribute("aria-current", "true");
      this.triggerTarget.setAttribute(
        "aria-activedescendant",
        selectedItem.getAttribute("id"),
      );
    } else {
      this.itemTarget.focus({ preventScroll: true });
      this.itemTarget.setAttribute("aria-current", "true");
      this.triggerTarget.setAttribute(
        "aria-activedescendant",
        this.itemTarget.getAttribute("id"),
      );
    }
  }

  resetCurrent() {
    this.itemTargets.forEach((item) => item.removeAttribute("aria-current"));
  }

  clickOutside(event) {
    if (!this.openValue) return;
    if (this.element.contains(event.target)) return;

    event.preventDefault();
    this.toogleContent();
  }

  toogleContent() {
    this.openValue = !this.openValue;
    this.triggerTarget.setAttribute("aria-expanded", this.openValue);

    if (this.openValue) {
      this.contentTarget.classList.remove("hidden");
      this.panelTarget.dataset.state = "open";
      return;
    }

    this.closeWithExitAnimation(this.panelTarget);
  }

  afterExit() {
    this.contentTarget.classList.add("hidden");
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

  setFloatingElement() {
    this.cleanup = autoUpdate(this.triggerTarget, this.contentTarget, () => {
      computePosition(this.triggerTarget, this.contentTarget, {
        middleware: [offset(4), flip()],
      }).then(({ x, y }) => {
        Object.assign(this.contentTarget.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      });
    });
  }

  generateItemsIds() {
    const contentId = this.contentTarget.getAttribute("id");
    this.triggerTarget.setAttribute("aria-controls", contentId);

    this.itemTargets.forEach((item, index) => {
      item.id = `${contentId}-${index}`;
    });
  }

  setAriaCurrentAndActiveDescendant(currentIndex) {
    const currentItem = this.itemTargets[currentIndex];
    currentItem.focus({ preventScroll: true });
    currentItem.setAttribute("aria-current", "true");
    this.triggerTarget.setAttribute(
      "aria-activedescendant",
      currentItem.getAttribute("id"),
    );
  }

  closeContent() {
    this.toogleContent();
    this.resetCurrent();

    this.triggerTarget.setAttribute("aria-activedescendant", true);
    this.triggerTarget.focus({ preventScroll: true });
  }

  dispatchOnChange(oldValue, newValue) {
    if (oldValue === newValue) return;

    const event = new InputEvent("change", {
      bubbles: true,
      cancelable: true,
    });

    this.inputTarget.dispatchEvent(event);
  }
}
