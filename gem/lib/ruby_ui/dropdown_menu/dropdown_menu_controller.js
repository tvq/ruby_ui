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
    this.panelTarget.dataset.state = "closed";
    this.hideAfterExitAnimation(this.panelTarget);
  }

  afterExit() {
    this.contentTarget.classList.add("hidden");
    // Held at 50 until now, so the menu fades above its siblings rather than behind them.
    this.element.style.zIndex = "";
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
