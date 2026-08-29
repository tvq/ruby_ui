import { Controller } from "@hotwired/stimulus"

// One pace however far the panel travels, like native sheets; only a flick settles faster, down to MIN_SETTLE_MS.
const OPEN_MS = 250
const SETTLE_MS = 200
const MIN_SETTLE_MS = 100
// A release faster than FLICK px/ms moves on to the next snap point in its direction, projected FLICK_MS ahead.
const FLICK = 0.4
const FLICK_MS = 200
// Scroll positions this close to a rest point count as being there.
const REST_SLACK = 4

// Bottom sheet on a native <dialog> + CSS scroll-snap: a full-screen spacer above the panel makes scrollTop 0 the dismissed rest position.
export default class extends Controller {
  static targets = ["scroller", "panel", "backdrop", "title", "description"]
  static values = {
    snapPoints: Array,
    initial: { type: Number, default: 0 },
    modal: { type: Boolean, default: true },
    dismissible: { type: Boolean, default: true }
  }

  ready = false
  dragging = false
  closing = false
  closed = false
  lockedBody = false
  keyboardInset = 0
  keyboardShift = false
  restPctBeforeKeyboard = null
  samples = []

  // showModal() brings top layer, focus trap and an inert page; show() keeps the page interactive, so Escape needs our own listener.
  connect() {
    this.labelDialog()

    if (this.modalValue) {
      // Only the lock we took is ours to release; a Dialog underneath keeps its own.
      this.lockedBody = !document.body.classList.contains("overflow-hidden")
      if (this.lockedBody) document.body.classList.add("overflow-hidden")
      this.element.showModal()
    } else {
      this.element.show()
      document.addEventListener("keydown", this.onKeydown)
    }
    this.element.addEventListener("cancel", this.onCancel)
    this.element.addEventListener("close", this.onClose)
    this.scrollerTarget.addEventListener("scroll", this.onScroll, { passive: true })
    this.scrollerTarget.addEventListener("scrollend", this.onSettle)
    this.trackKeyboard()

    // After show: native autofocus may have scrolled the panel into view.
    this.scrollerTarget.scrollTop = 0
    this.animateOpen()
  }

  // Losing the controller while open (Stimulus stopped, element swapped out) must not leave a dead modal in the top layer.
  disconnect() {
    this.teardown()
  }

  // Name the dialog by its own title and description, as Radix does.
  labelDialog() {
    if (this.hasTitleTarget) this.element.setAttribute("aria-labelledby", this.idFor(this.titleTarget))
    if (this.hasDescriptionTarget) this.element.setAttribute("aria-describedby", this.idFor(this.descriptionTarget))
  }

  idFor(element) {
    element.id ||= `ruby-ui-drawer-${Math.random().toString(36).slice(2, 8)}`
    return element.id
  }

  get restPcts() {
    return this.snapPointsValue.length ? this.snapPointsValue : [100]
  }

  get openPct() {
    return this.restPcts[this.initialValue] ?? this.restPcts[0]
  }

  get openOffset() {
    return this.offsetFor(this.openPct)
  }

  get snapOffsets() {
    return this.restPcts.map((pct) => this.offsetFor(pct))
  }

  get lowestOffset() {
    return Math.min(...this.snapOffsets)
  }

  get highestOffset() {
    return Math.max(...this.snapOffsets)
  }

  // Where the panel may rest: the snap points, plus 0 — dismissed — when dismissible.
  get restPoints() {
    return this.dismissibleValue ? [0, ...this.snapOffsets] : this.snapOffsets
  }

  offsetFor(pct) {
    return Math.round((this.scrollerTarget.clientHeight * pct) / 100)
  }

  nearestRestPct() {
    return this.nearest(this.restPcts, this.scrollerTarget.scrollTop, (pct) => this.offsetFor(pct))
  }

  nearest(values, target = this.scrollerTarget.scrollTop, offsetOf = (value) => value) {
    return values.reduce((best, value) => (Math.abs(offsetOf(value) - target) < Math.abs(offsetOf(best) - target) ? value : best))
  }

  onScroll = () => {
    this.trackBand()
    this.trackScrim()
    this.scheduleSettle()
  }

  // Below the lowest snap point the scrim follows the panel, so swiping out fades it like a native sheet.
  trackScrim() {
    if (!this.hasBackdropTarget || !this.ready || this.closing) return
    this.backdropTarget.style.opacity = Math.min(1, this.scrollerTarget.scrollTop / this.lowestOffset)
  }

  // Only the band above the fold is laid out, floored at the open offset so the layout stays rigid while sliding open or out.
  trackBand() {
    const band = Math.max(this.scrollerTarget.scrollTop, this.openOffset)
    this.element.style.setProperty("--drawer-band", `${Math.round(band)}px`)
  }

  // Settles without scrollend (older Safari); where it exists onSettle simply runs twice and the guards make that a no-op.
  scheduleSettle() {
    clearTimeout(this.settleTimer)
    this.settleTimer = setTimeout(this.onSettle, 120)
  }

  onSettle = () => {
    if (this.closing || this.dragging || this.keyboardShift) return
    const atBottom = this.scrollerTarget.scrollTop <= REST_SLACK
    if (!this.ready) {
      this.ready = !atBottom
      return
    }
    if (!atBottom) return

    if (this.dismissibleValue) this.close()
    else this.animateScroll(this.lowestOffset, SETTLE_MS)
  }

  // iOS has no keyboard-inset env(): derive the keyboard height from the visual viewport and lift the scroller.
  trackKeyboard() {
    if (!window.visualViewport) return
    visualViewport.addEventListener("resize", this.onViewport)
    visualViewport.addEventListener("scroll", this.onViewport)
  }

  onViewport = () => {
    const viewport = window.visualViewport
    this.followKeyboard(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
  }

  // The pre-keyboard snap survives as a percentage — px offsets die with any resize.
  followKeyboard(inset) {
    inset = Math.round(inset)
    if (inset === this.keyboardInset) return
    const toggled = (inset > 0) !== (this.keyboardInset > 0)
    if (toggled && inset > 0 && !this.dragging) this.restPctBeforeKeyboard = this.nearestRestPct()
    this.keyboardInset = inset
    this.scrollerTarget.style.bottom = `${inset}px`
    this.trackBand()
    if (!toggled || this.dragging || this.closing) return

    if (inset > 0) {
      this.shiftTo(this.highestOffset)
    } else if (this.restPctBeforeKeyboard != null) {
      this.shiftTo(this.offsetFor(this.restPctBeforeKeyboard))
      this.restPctBeforeKeyboard = null
    }
  }

  // Chrome may clamp scrollTop to 0 while the scroller resizes; settling pauses so that is not read as a dismissal.
  shiftTo(offset) {
    this.keyboardShift = true
    this.animateScroll(offset, SETTLE_MS, () => { this.keyboardShift = false })
  }

  onKeydown = (event) => {
    if (event.key !== "Escape" || !this.dismissibleValue) return
    event.preventDefault()
    this.close()
  }

  // Escape on a modal dialog: cancel the instant native close, run ours instead.
  onCancel = (event) => {
    event.preventDefault()
    this.dismiss()
  }

  // Anything else that closes the dialog (e.g. a method="dialog" form) still tears the drawer down.
  onClose = () => {
    this.teardown()
  }

  // Not scrollTo(): mandatory snap fights it mid-flight on a freshly inserted scroller and the open jumps.
  animateOpen() {
    this.animateScroll(this.openOffset, OPEN_MS)
  }

  animateScroll(to, duration, onDone) {
    const scroller = this.scrollerTarget
    cancelAnimationFrame(this.frame)
    scroller.style.scrollSnapType = "none"
    const from = scroller.scrollTop

    let startTime = null
    const step = (now) => {
      if (startTime === null) startTime = now
      const t = Math.min(1, (now - startTime) / duration)
      scroller.scrollTop = from + (to - from) * (1 - (1 - t) ** 3)

      if (t < 1) {
        this.frame = requestAnimationFrame(step)
      } else {
        scroller.style.scrollSnapType = ""
        onDone?.()
      }
    }
    this.frame = requestAnimationFrame(step)
  }

  // Pointer-driven: WebKit will not scroll the pointer-events:none snap scroller by touch, so the handle drives it.
  startDrag(event) {
    if (this.closing) return
    event.preventDefault()
    // A grab during the open animation would otherwise fight it for scrollTop.
    cancelAnimationFrame(this.frame)
    this.dragging = true
    this.restPctBeforeKeyboard = null
    this.keyboardShift = false
    this.dragOrigin = event.clientY
    this.dragFrom = this.scrollerTarget.scrollTop
    this.samples = [{ t: event.timeStamp, y: event.clientY }]
    this.scrollerTarget.style.scrollSnapType = "none"
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  drag(event) {
    if (!this.dragging) return
    this.samples.push({ t: event.timeStamp, y: event.clientY })
    if (this.samples.length > 8) this.samples.shift()
    this.scrollerTarget.scrollTop = Math.max(0, this.dragFrom - (event.clientY - this.dragOrigin))
  }

  endDrag(event) {
    if (!this.dragging) return
    this.dragging = false
    // pointercancel has already released it, and releasing twice throws.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const velocity = this.releaseVelocity(event)
    const rest = this.restTarget(velocity)
    const duration = this.releaseDuration(Math.abs(rest - this.scrollerTarget.scrollTop), velocity)
    if (rest === 0) this.slideOut(duration)
    else this.animateScroll(rest, duration)
  }

  // px/ms in scroll direction (positive opens) over the last 100ms of movement; a pause before release is not a flick.
  releaseVelocity(event) {
    const last = this.samples.at(-1)
    if (event.timeStamp - last.t > 100) return 0
    const first = this.samples.find((sample) => last.t - sample.t <= 100)
    const elapsed = last.t - first.t
    return elapsed > 0 ? (first.y - last.y) / elapsed : 0
  }

  // A slow release settles on the nearest rest point; a flick moves on to the next one in its direction.
  restTarget(velocity) {
    const top = this.scrollerTarget.scrollTop
    const ahead = this.restPoints.filter((point) => (velocity > 0 ? point > top + REST_SLACK : point < top - REST_SLACK))
    if (Math.abs(velocity) < FLICK || ahead.length === 0) return this.nearest(this.restPoints)
    return this.nearest(ahead, top + velocity * FLICK_MS)
  }

  releaseDuration(distance, velocity) {
    if (Math.abs(velocity) < FLICK) return SETTLE_MS
    return Math.min(SETTLE_MS, Math.max(MIN_SETTLE_MS, distance / Math.abs(velocity)))
  }

  // The scrim, Escape and a swipe out ask; DrawerClose tells.
  dismiss() {
    if (this.dismissibleValue) this.close()
  }

  close() {
    this.slideOut(SETTLE_MS)
  }

  slideOut(duration) {
    if (this.closing) return
    this.closing = true

    if (this.hasBackdropTarget) {
      this.backdropTarget.style.setProperty("--tw-animation-duration", `${duration}ms`)
      this.backdropTarget.dataset.state = "closed"
    }
    this.animateScroll(0, duration, () => this.teardown())
  }

  // dialog.close() (not just remove) so the browser restores focus to the trigger.
  teardown() {
    if (this.closed) return
    this.closed = true
    this.cleanup()
    if (this.element.open) this.element.close()
    this.element.remove()
  }

  cleanup() {
    if (this.lockedBody) document.body.classList.remove("overflow-hidden")
    cancelAnimationFrame(this.frame)
    clearTimeout(this.settleTimer)
    document.removeEventListener("keydown", this.onKeydown)
    this.element.removeEventListener("cancel", this.onCancel)
    this.element.removeEventListener("close", this.onClose)
    if (this.hasScrollerTarget) {
      this.scrollerTarget.removeEventListener("scroll", this.onScroll)
      this.scrollerTarget.removeEventListener("scrollend", this.onSettle)
    }
    window.visualViewport?.removeEventListener("resize", this.onViewport)
    window.visualViewport?.removeEventListener("scroll", this.onViewport)
  }
}
