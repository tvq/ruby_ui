# frozen_string_literal: true

module RubyUI
  class DrawerContent < Base
    # snap_points: % of the viewport the panel covers at each rest position; initial: index it opens at.
    # dismissible: false ignores the scrim click, Escape and a swipe below the lowest snap point.
    def initialize(snap_points: [60, 92], initial: 0, modal: true, dismissible: true, handle: true, **attrs)
      @snap_points = snap_points
      @initial = initial
      @modal = modal
      @dismissible = dismissible
      @handle = handle
      super(**attrs)
    end

    def view_template(&block)
      template(data: {ruby_ui__drawer_target: "content"}) do
        dialog(**dialog_attrs) do
          backdrop if @modal
          scroller do
            @snap_points.each { |pct| snap_marker(pct) }
            # Full-screen spacer: makes the scroll range, and scrollTop 0 the dismissed rest position.
            div(class: "h-full snap-start")
            div(**attrs) do
              RubyUI.DrawerSwipeHandle() if @handle
              block&.call
            end
          end
        end
      end
    end

    private

    # The panel is full-height; only the band above the fold (--drawer-band, tracked by the controller) is laid out.
    def default_attrs
      {
        class: "relative flex h-full flex-col overflow-clip rounded-t-lg bg-background text-foreground shadow-[0_-8px_30px_rgb(0_0_0/0.12)] snap-start pointer-events-auto after:flex-none after:h-[calc(100%_-_var(--drawer-band))] after:content-['']",
        data: {ruby_ui__drawer_content_target: "panel"}
      }
    end

    # Full-screen transparent <dialog> with pointer events off (the non-modal page stays reachable); backdrop and panel opt back in.
    def dialog_attrs
      {
        class: "fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 bg-transparent p-0 pointer-events-none backdrop:bg-transparent",
        style: "--drawer-band: #{open_pct}%",
        data: {
          controller: "ruby-ui--drawer-content",
          turbo_temporary: true,
          ruby_ui__drawer_content_snap_points_value: @snap_points.to_json,
          ruby_ui__drawer_content_initial_value: @initial,
          ruby_ui__drawer_content_modal_value: @modal.to_s,
          ruby_ui__drawer_content_dismissible_value: @dismissible.to_s
        }
      }
    end

    def open_pct = @snap_points[@initial.clamp(0..)] || @snap_points.first || 100

    def backdrop
      div(
        class: "fixed inset-0 z-50 pointer-events-auto bg-background/80 backdrop-blur-sm transition-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:fill-mode-forwards",
        data: {
          state: "open",
          action: "click->ruby-ui--drawer-content#dismiss",
          ruby_ui__drawer_content_target: "backdrop"
        }
      )
    end

    # Vertical snap scroller: scrolling up reveals the panel and the browser snaps to the markers.
    def scroller(&)
      div(
        class: "fixed inset-0 z-50 overflow-y-scroll overscroll-y-none snap-y snap-mandatory pointer-events-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        data: {ruby_ui__drawer_content_target: "scroller"},
        &
      )
    end

    # Zero-height sentinel whose ::before sits exactly pct% down the scroller.
    def snap_marker(pct)
      div(
        class: "relative -mb-px h-px before:absolute before:inset-x-0 before:top-px before:h-px before:snap-start before:content-['']",
        style: "top: calc(#{pct}% - 1px)"
      )
    end
  end
end
