# frozen_string_literal: true

module RubyUI
  class SelectContent < Base
    def initialize(**attrs)
      @id = "content#{SecureRandom.hex(4)}"
      super
    end

    def view_template(&block)
      div(**attrs) do
        div(
          class: "max-h-96 w-full text-wrap overflow-auto rounded-md border bg-background p-1 text-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:fill-mode-forwards slide-in-from-top-2",
          data: {state: :closed, ruby_ui__select_target: "panel"},
          &block
        )
      end
    end

    private

    def default_attrs
      {
        id: @id,
        role: "listbox",
        tabindex: "-1",
        data: {
          ruby_ui__select_target: "content"
        },
        class: "hidden w-full absolute top-0 left-0 z-50"
      }
    end
  end
end
