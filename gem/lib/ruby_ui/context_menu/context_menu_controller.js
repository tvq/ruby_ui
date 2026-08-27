import { Controller } from "@hotwired/stimulus";
import {
  computePosition,
  flip,
  shift,
  offset,
  autoUpdate,
} from "@floating-ui/dom";

export default class extends Controller {
  static targets = ["trigger", "content", "menuItem"];
  static values = {
    open: { type: Boolean, default: false },
    options: { type: Object, default: {} },
    // make content width match the trigger element (true/false)
    matchWidth: { type: Boolean, default: false },
  };

  connect() {
    this.cleanup = null;
    this.selectedIndex = -1;
    this.boundHandleKeydown = this.handleKeydown.bind(this);
  }

  disconnect() {
    this.hide();
    // Nothing is left to wait for the exit animation, so apply the pending hide now.
    if (this.hasContentTarget) this.settleExit(this.contentTarget);
  }

  handleContextMenu(event) {
    event.preventDefault();
    this.open();
  }

  open() {
    this.openValue = true;
    this.contentTarget.classList.remove("hidden");
    this.contentTarget.dataset.state = "open";
    if (this.matchWidthValue) {
      this.contentTarget.style.width = `${this.triggerTarget.offsetWidth}px`;
    }
    this.addEventListeners();
    this.updatePosition();
  }

  close() {
    this.hide();
  }

  hide() {
    if (!this.openValue) return;
    this.openValue = false;
    this.removeEventListeners();
    this.deselectAll();
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }

    if (!this.hasContentTarget) return;

    this.closeWithExitAnimation(this.contentTarget);
  }

  afterExit(content) {
    content.classList.add("hidden");
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

  updatePosition() {
    if (this.cleanup) this.cleanup();

    this.cleanup = autoUpdate(this.triggerTarget, this.contentTarget, () => {
      computePosition(this.triggerTarget, this.contentTarget, {
        placement: this.optionsValue.placement || "bottom-start",
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      }).then(({ x, y, placement }) => {
        Object.assign(this.contentTarget.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
        this.contentTarget.dataset.side = placement.split("-")[0];
      });
    });
  }

  addEventListeners() {
    document.addEventListener("keydown", this.boundHandleKeydown);
    document.addEventListener("click", this.handleOutsidePointer);
    // A right-click outside should dismiss this menu and let the native
    // context menu (or another trigger's menu) take over.
    document.addEventListener("contextmenu", this.handleOutsidePointer);
  }

  removeEventListeners() {
    document.removeEventListener("keydown", this.boundHandleKeydown);
    document.removeEventListener("click", this.handleOutsidePointer);
    document.removeEventListener("contextmenu", this.handleOutsidePointer);
  }

  handleOutsidePointer = (event) => {
    if (!this.element.contains(event.target)) {
      this.hide();
    }
  };

  handleKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
      return;
    }

    if (this.menuItemTargets.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.updateSelectedItem(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.updateSelectedItem(-1);
    } else if (e.key === "Enter" && this.selectedIndex !== -1) {
      e.preventDefault();
      this.menuItemTargets[this.selectedIndex].click();
    }
  }

  updateSelectedItem(direction) {
    this.menuItemTargets.forEach((item, index) => {
      if (item.getAttribute("aria-selected") === "true") {
        this.selectedIndex = index;
      }
    });

    if (this.selectedIndex >= 0) {
      this.toggleAriaSelected(this.menuItemTargets[this.selectedIndex], false);
    }

    this.selectedIndex += direction;

    if (this.selectedIndex < 0) {
      this.selectedIndex = this.menuItemTargets.length - 1;
    } else if (this.selectedIndex >= this.menuItemTargets.length) {
      this.selectedIndex = 0;
    }

    this.toggleAriaSelected(this.menuItemTargets[this.selectedIndex], true);
  }

  toggleAriaSelected(element, isSelected) {
    if (isSelected) {
      element.setAttribute("aria-selected", "true");
    } else {
      element.removeAttribute("aria-selected");
    }
  }

  deselectAll() {
    this.menuItemTargets.forEach((item) =>
      this.toggleAriaSelected(item, false)
    );
    this.selectedIndex = -1;
  }
}
