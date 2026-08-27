import { Controller } from "@hotwired/stimulus";
import {
  computePosition,
  flip,
  shift,
  offset,
  autoUpdate,
} from "@floating-ui/dom";

export default class extends Controller {
  static targets = ["trigger", "content", "panel", "menuItem"];
  static values = {
    open: {
      type: Boolean,
      default: false,
    },
    options: {
      type: Object,
      default: {},
    },
  };

  connect() {
    this.boundHandleKeydown = this.#handleKeydown.bind(this); // Bind the function so we can remove it later
    this.selectedIndex = -1;

    this.#setupAutoUpdate();
  }

  disconnect() {
    if (this.autoUpdateCleanup) {
      this.autoUpdateCleanup();
    }
    // Nothing is left to wait for the exit animation, so apply the pending hide now.
    if (this.hasPanelTarget) this.settleExit(this.panelTarget);
  }

  #setupAutoUpdate() {
    this.autoUpdateCleanup = autoUpdate(
      this.triggerTarget,
      this.contentTarget,
      this.#computeTooltip.bind(this),
    );
  }

  #computeTooltip() {
    computePosition(this.triggerTarget, this.contentTarget, {
      placement: this.optionsValue.placement || "bottom",
      middleware: [flip(), shift(), offset(8)],
      strategy: this.optionsValue.strategy || "absolute",
    }).then(({ x, y }) => {
      Object.assign(this.contentTarget.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }

  onClickOutside(event) {
    if (!this.openValue) return;
    if (this.element.contains(event.target)) return;

    event.preventDefault();
    this.close();
  }

  toggle() {
    // `hidden` now lands after the exit animation, so it no longer tells the states apart.
    this.openValue ? this.close() : this.#open();
  }

  #open() {
    this.openValue = true;
    this.#deselectAll();
    this.#addEventListeners();
    this.#computeTooltip();
    // Lift the open menu above sibling dropdowns/elements. The container has no
    // static z-index, so closed siblings stack in normal flow and never cover it.
    this.element.style.zIndex = "50";
    this.contentTarget.classList.remove("hidden");
    this.panelTarget.dataset.state = "open";
  }

  close() {
    this.openValue = false;
    this.#removeEventListeners();
    this.closeWithExitAnimation(this.panelTarget);
  }

  afterExit() {
    this.contentTarget.classList.add("hidden");
    // Held at 50 until now, so the menu fades above its siblings rather than behind them.
    this.element.style.zIndex = "";
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

  #handleKeydown(e) {
    // return if no menu items (one line fix for)
    if (this.menuItemTargets.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.#updateSelectedItem(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.#updateSelectedItem(-1);
    } else if (e.key === "Enter" && this.selectedIndex !== -1) {
      e.preventDefault();
      this.menuItemTargets[this.selectedIndex].click();
    }
  }

  #updateSelectedItem(direction) {
    // Check if any of the menuItemTargets have aria-selected="true" and set the selectedIndex to that index
    this.menuItemTargets.forEach((item, index) => {
      if (item.getAttribute("aria-selected") === "true") {
        this.selectedIndex = index;
      }
    });

    if (this.selectedIndex >= 0) {
      this.#toggleAriaSelected(this.menuItemTargets[this.selectedIndex], false);
    }

    this.selectedIndex += direction;

    if (this.selectedIndex < 0) {
      this.selectedIndex = this.menuItemTargets.length - 1;
    } else if (this.selectedIndex >= this.menuItemTargets.length) {
      this.selectedIndex = 0;
    }

    this.#toggleAriaSelected(this.menuItemTargets[this.selectedIndex], true);
  }

  #toggleAriaSelected(element, isSelected) {
    // Add or remove attribute
    if (isSelected) {
      element.setAttribute("aria-selected", "true");
    } else {
      element.removeAttribute("aria-selected");
    }
  }

  #deselectAll() {
    this.menuItemTargets.forEach((item) =>
      this.#toggleAriaSelected(item, false),
    );
    this.selectedIndex = -1;
  }

  #addEventListeners() {
    document.addEventListener("keydown", this.boundHandleKeydown);
  }

  #removeEventListeners() {
    document.removeEventListener("keydown", this.boundHandleKeydown);
  }
}
