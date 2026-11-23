---
name: roblox-trend-game
description: Use when a Roblox dev wants to build a fast trend-format game, i.e. "make a steal-a-X game", "collect, upgrade, steal loop", "ride this trend before it dies", or "add a weekly event to my tycoon". Plans a one-twist version of the format, builds the core loop in days, ships it under current Roblox rules and keeps it alive with live ops.
---

# Trend game: format, twist, ship, keep alive

A trend game copies a format players already understand (collect things,
upgrade a base, steal from other players) and adds one twist they haven't
seen. Speed matters more than polish, but the loop must be honest and secure.

## Before you build

- Read the rules in `<VAULTS>/Roblox Knowledge/rules/`: `game-design.md`,
  `reward-juice.md`, `monetization.md`, `ui.md` and `traps.md` first. Follow
  them; don't restate them in code comments or docs.
- Ask the dev for the format they're chasing and the twist, in one line each.
  If they have no twist, offer three and let them pick. One twist, not five.

## Steps

1. **Write the loop on one screen.** Collect what, upgrade what, steal what,
   and what the twist changes. Name the one number a player watches grow.
   Get the dev's yes before building.
2. **Build collect and upgrade first, solo-playable.** A new player should
   earn their first upgrade inside a minute. All currency and inventory
   changes happen on the server; clients only ask.
3. **Add steal as a server-checked action.** A `ProximityPrompt` with a
   `HoldDuration` gives the thief a visible wind-up and the owner time to
   react. Handle `Triggered(playerWhoTriggered)` in a server Script and
   re-check distance, ownership, cooldown and base protection there. Use
   the `roblox-secure-remotes` skill for any RemoteEvent the loop needs.
4. **Give losers a way back.** Stealing must never zero a player out: keep a
   protected floor, a short shield after a theft, or a revenge window.
5. **Save progress safely.** Follow the `roblox-datastore-safety` skill for
   the profile, and save stolen items as one transaction on both players.
6. **Monetize within the rules.** Follow the `roblox-monetization` skill.
   For anything random that costs Robux, call
   `PolicyService:GetPolicyInfoForPlayerAsync(player)` in a `pcall` and hide
   the paid random item when `ArePaidRandomItemsRestricted` is true. Never
   sell an advantage that makes stealing from free players unstoppable.
7. **Instrument the funnel.** From the server, log the first collect, first
   upgrade and first steal with
   `AnalyticsService:LogOnboardingFunnelStepEvent`, and every currency
   source and sink with `AnalyticsService:LogEconomyEvent`.
8. **Rate before release.** Ask the dev to complete the Content Ratings
   Questionnaire on the Creator Dashboard; games without ratings have
   restricted playability. You don't fill it in or publish for them.
9. **Score it.** Run the `roblox-quality-score` skill on every asset type
   you shipped, then the game's own `scripts/check` or test suite.

## Live ops

- Put tunables (drop rates, upgrade costs, event multipliers) in
  `ConfigService`, read with `GetConfigAsync()` on the server, so they change
  without a new place version. The `rbx-configs-experimentation` skill covers
  ConfigService in depth; use it if it's installed.
- Plan a cadence: a small change each week (new collectable, limited
  multiplier) and a bigger one each month (new zone, new steal counter).
- Read the funnel and economy dashboards before each change. Fix the worst
  drop-off step before adding content.
- Retire the trend gracefully: when daily players fall for several weeks,
  shrink the update cadence instead of stacking more events.

## Ask first

Publishing a place, changing experience settings, creating products or
passes, spending Robux on ads, and installing plugins or packages all need
the dev's explicit yes, every time.

## Finish checklist

- [ ] Loop written down, twist named, dev agreed
- [ ] First upgrade reachable inside a minute by a new player
- [ ] Every steal and currency change is decided on the server
- [ ] A robbed player always keeps a floor and a way back
- [ ] Paid random items hidden where policy restricts them
- [ ] Onboarding funnel and economy events logged from the server
- [ ] Live tunables read from ConfigService, not hard-coded
- [ ] Dev reminded about the Content Ratings Questionnaire
- [ ] Quality scores at 8.5 or above, and the game's own checks pass
