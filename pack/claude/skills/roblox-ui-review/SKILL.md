---
name: roblox-ui-review
description: Use when a Roblox dev wants their UI checked or fixed for other screens, i.e. "does this work on phone", "review my HUD", "the buttons are under the notch" or "check the shop on tablet". Reviews responsive layout, safe areas, motion and accessibility, then checks phone and tablet in the Device Simulator.
---

# Roblox UI review

Review one screen or the whole HUD, fix what fails, and prove it on a phone
and a tablet. Judge against the vault, not taste.

## Before you start

- Read `<VAULTS>/Roblox Knowledge/rules/ui.md`. Its rules are the pass mark;
  don't restate them to the dev, cite them.
- Ask which screens to review if the dev didn't say. Default to every
  ScreenGui under `StarterGui`.
- Ask before changing game settings or installing anything. Editing the UI
  in the place is fine.

## Steps

1. **Inventory.** List each ScreenGui and its main frames. Note anything
   sized or placed in pixels (`Offset`) that should scale.
2. **Responsive layout.** Prefer `Scale` for size and position, with layout
   objects (UIListLayout, UIGridLayout, UIPadding) instead of hand-placed
   offsets. Hold shapes with UIAspectRatioConstraint, cap sizes with
   UISizeConstraint, and keep text readable with UITextSizeConstraint. Use
   UIScale when a whole panel must shrink together.
3. **Safe areas.** Check each ScreenGui's `ScreenInsets`. Interactive or
   important UI uses `CoreUISafeInsets`, which clears both device cutouts and
   Roblox's own buttons. `DeviceSafeInsets` clears cutouts only. `None` is
   for backgrounds and decoration only.
4. **Motion.** Find tweens and animated UI. Each should be short, have a
   reason and never block input. Read `GuiService.ReducedMotionEnabled` on
   the client; when it is true, swap movement for a fade or an instant change.
5. **Accessibility.** Read `GuiService.PreferredTextSize` on the client and
   scale text up for Large and above; listen with
   `GetPropertyChangedSignal("PreferredTextSize")` so it updates live. Check
   contrast, that colour is never the only signal, and that touch targets
   are big enough for a thumb.
6. **Input.** Use `UserInputService.PreferredInput` (Touch, Gamepad or
   KeyboardAndMouse) to choose prompts and button hints, rather than guessing
   the device from screen size. Check that gamepad selection can reach every
   button.
7. **Device check.** Use the `rbx-device-simulator-lua` skill to view each
   screen on at least one phone and one tablet, in portrait and landscape
   where the game allows it. Take a screenshot of each.
8. **Fix and repeat.** Fix each failure, then rerun step 7 for the screens
   you changed.
9. **Report.** Give the dev a short table: screen, device, pass or what
   changed. Attach the screenshots.

## Finish checklist

- [ ] Every reviewed frame scales; no fixed pixel layout breaks on phone.
- [ ] Interactive UI sits inside `CoreUISafeInsets`; nothing important is
      under a notch or the Roblox buttons.
- [ ] Reduced motion is respected wherever UI moves.
- [ ] Text follows `PreferredTextSize` and stays readable at the largest
      setting.
- [ ] Prompts match `PreferredInput`, and a gamepad can reach every button.
- [ ] Phone and tablet screenshots exist for every reviewed screen.
- [ ] Each fix was rechecked in the simulator.
- [ ] Every finding cites a rule in the vault's `ui.md`.
