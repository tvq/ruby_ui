import { Controller } from "@hotwired/stimulus";
import Fuse from "fuse.js";

// Connects to data-controller="ruby-ui--command"
export default class extends Controller {
  static targets = ["input", "group", "item", "empty", "backdrop", "panel"];

  connect() {
    this.selectedIndex = -1;

    if (!this.hasInputTarget) {
      return;
    }

    this.inputTarget.focus();
    this.searchIndex = this.buildSearchIndex();
    this.toggleVisibility(this.emptyTargets, false);
  }

  disconnect() {
    // Nothing is left to wait for the exit animation, so apply the pending removal now.
    if (this.hasPanelTarget) this.settleExit(this.panelTarget);
  }

  dismiss() {
    this.backdropTarget.dataset.state = "closed";
    this.closeWithExitAnimation(this.panelTarget);
  }

  // Opened again while dismissing: bring this instance back instead of stacking a new one.
  show() {
    this.backdropTarget.dataset.state = "open";
    this.panelTarget.dataset.state = "open";
    document.body.classList.add("overflow-hidden");
    this.focusInput();
  }

  afterExit() {
    document.body.classList.remove("overflow-hidden");
    this.element.remove();
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

  focusInput() {
    this.inputTarget?.focus();
  }

  filter(e) {
    // Deselect any previously selected item
    this.deselectAll();

    const query = e.target.value.toLowerCase();
    if (query.length === 0) {
      this.resetVisibility();
      return;
    }

    this.toggleVisibility(this.itemTargets, false);

    const results = this.searchIndex.search(query);
    results.forEach((result) =>
      this.toggleVisibility([result.item.element], true),
    );

    this.toggleVisibility(this.emptyTargets, results.length === 0);
    this.updateGroupVisibility();
  }

  toggleVisibility(elements, isVisible) {
    elements.forEach((el) => el.classList.toggle("hidden", !isVisible));
  }

  updateGroupVisibility() {
    this.groupTargets.forEach((group) => {
      const hasVisibleItems =
        group.querySelectorAll(
          "[data-ruby-ui--command-target='item']:not(.hidden)",
        ).length > 0;
      this.toggleVisibility([group], hasVisibleItems);
    });
  }

  resetVisibility() {
    this.toggleVisibility(this.itemTargets, true);
    this.toggleVisibility(this.groupTargets, true);
    this.toggleVisibility(this.emptyTargets, false);
  }

  buildSearchIndex() {
    const options = {
      keys: ["value"],
      threshold: 0.2,
      includeMatches: true,
    };
    const items = this.itemTargets.map((el) => ({
      value: el.dataset.value,
      element: el,
    }));
    return new Fuse(items, options);
  }

  handleKeydown(e) {
    const visibleItems = this.itemTargets.filter(
      (item) => !item.classList.contains("hidden"),
    );
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.updateSelectedItem(visibleItems, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.updateSelectedItem(visibleItems, -1);
    } else if (e.key === "Enter" && this.selectedIndex !== -1) {
      e.preventDefault();
      visibleItems[this.selectedIndex].click();
    }
  }

  updateSelectedItem(visibleItems, direction) {
    if (this.selectedIndex >= 0) {
      this.toggleAriaSelected(visibleItems[this.selectedIndex], false);
    }

    this.selectedIndex += direction;

    // Ensure the selected index is within the bounds of the visible items
    if (this.selectedIndex < 0) {
      this.selectedIndex = visibleItems.length - 1;
    } else if (this.selectedIndex >= visibleItems.length) {
      this.selectedIndex = 0;
    }

    this.toggleAriaSelected(visibleItems[this.selectedIndex], true);
  }

  toggleAriaSelected(element, isSelected) {
    element.setAttribute("aria-selected", isSelected.toString());
  }

  deselectAll() {
    this.itemTargets.forEach((item) => this.toggleAriaSelected(item, false));
    this.selectedIndex = -1;
  }
}
