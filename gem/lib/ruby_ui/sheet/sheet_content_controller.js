import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["backdrop", "panel"];

  disconnect() {
    // Nothing is left to wait for the exit animation, so apply the pending removal now.
    if (this.hasPanelTarget) this.settleExit(this.panelTarget);
  }

  close() {
    this.backdropTarget.dataset.state = "closed";
    // The panel carries the longer exit, so the backdrop has finished by the time it settles.
    this.closeWithExitAnimation(this.panelTarget);
  }

  afterExit() {
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
}
