# frozen_string_literal: true

require "test_helper"

class RubyUI::ClipboardTest < ComponentTest
  def test_render_with_all_items
    output = phlex do
      RubyUI.Clipboard(success: "Copied!", error: "Copy Failed!")
    end

    assert_match(/Copied/, output)
  end

  # `hidden` lands a frame after the animation ends; without a forwards fill mode that frame flashes.
  def test_content_holds_the_last_frame_of_the_exit_animation
    output = phlex do
      RubyUI.ClipboardPopover(type: :success) { "Copied!" }
    end

    assert_match(/data-\[state=closed\]:fill-mode-forwards/, output)
  end
end
