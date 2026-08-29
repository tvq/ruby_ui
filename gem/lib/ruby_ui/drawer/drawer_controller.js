import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["content"]
  static values = { open: { type: Boolean, default: false } }

  connect() {
    if (this.openValue) this.open()
  }

  // The content waits in a <template>; a copy goes to <body> so the fixed dialog
  // is not caught by a transformed ancestor.
  open(event) {
    event?.preventDefault()
    if (this.dialog?.isConnected) return

    this.dialog = this.contentTarget.content.firstElementChild.cloneNode(true)
    this.dialog.addEventListener("close", () => { this.dialog = null }, { once: true })
    document.body.append(this.dialog)
  }
}
