---
name: roblox-monetization
description: Use when adding or fixing game passes, developer products, Robux shops or paid random rewards in a Roblox game, i.e. "add a VIP pass", "sell 100 coins", "purchases aren't granting", "players got charged twice", or "add a paid crate". Builds server-side pass checks and an idempotent ProcessReceipt (grant, save, then return PurchaseGranted), and applies the odds rules for paid random items.
---

# Monetization: grant once, save, then confirm

Roblox charges the player, then asks your server to grant the purchase.
Your server must grant exactly once, save, and only then confirm.

What to sell, how to price it and what feels fair are design rules in
`<VAULTS>/Roblox Knowledge/rules/monetization.md`. Read and follow that
file before suggesting any product. This skill covers the code.

## Ask first

Creating, repricing or taking items off sale, and test purchases with real
Robux, all act outside the project. Ask the dev before each one. To create
passes or products through Open Cloud, the `rbx-open-cloud-usage` skill
covers that; otherwise the dev makes them in the Creator Hub and gives you
the IDs.

## Steps, in order

1. **Get the IDs.** Put every pass and product ID in one server-side
   config module, with what each grants. The client gets IDs only to show
   prompts; the grant table stays on the server.
2. **Show prices from Roblox.** Read name and price with
   `MarketplaceService:GetProductInfoAsync` (the older `GetProductInfo`
   is deprecated). Don't hard-code Robux prices in UI.
3. **Prompt from the client.** `PromptGamePassPurchase(player, passId)` for
   passes, `PromptProductPurchase(player, productId)` for products. A
   prompt never grants anything.
4. **Passes: check on the server.** On `Players.PlayerAdded`, call
   `UserOwnsGamePassAsync(player.UserId, passId)` in `pcall` and apply the
   perk. For a purchase mid-session, listen to
   `PromptGamePassPurchaseFinished` in a server script and grant when it
   reports success for that pass. Results are cached, so re-checking is cheap.
5. **Products: one ProcessReceipt.** Set
   `MarketplaceService.ProcessReceipt` once, in one server script. It gets
   `receiptInfo` with `PurchaseId`, `PlayerId`, `ProductId`,
   `CurrencySpent` and more. Inside it:
   1. Find the player by `PlayerId`. Not in this server: return
      `NotProcessedYet`.
   2. Wait for their data to load. Load failed: return `NotProcessedYet`.
   3. If `PurchaseId` is already in their history, don't grant again. If
      that history is saved, return `PurchaseGranted`; if not, jump to 6.
   4. Look up the grant for `ProductId`. Unknown: return `NotProcessedYet`.
   5. Grant it to the in-memory data and record the `PurchaseId` there.
   6. Save now, through the session-locked save from
      `roblox-datastore-safety`.
   7. Saved: return `PurchaseGranted`. Not saved: return `NotProcessedYet`;
      step 3 will settle it next time.
   Any error goes to `NotProcessedYet`, never to `PurchaseGranted`.
6. **Know when it retries.** A receipt left `NotProcessedYet` is not retried
   on a timer. It comes back when the player buys another product or rejoins.
   So the handler must be safe to run many times for one `PurchaseId`.
7. **Don't grant from finish events on the client.**
   `PromptProductPurchaseFinished` firing doesn't mean the purchase went
   through. Client-side finish events are for UI only.
8. **Trim history.** Keep purchase IDs long enough to catch repeats, but cap
   the list so the save stays small.

## Paid random items

Anything random bought with Robux, directly or with currency bought with
Robux (crates, spins, luck boosts, pity systems):

- Before the player pays, show every possible outcome and its odds as
  percentages that add up to 100%, with a rounding note if needed.
- Call `PolicyService:GetPolicyInfoForPlayerAsync(player)` in `pcall`. If
  `ArePaidRandomItemsRestricted` is true, that player can't use the paid
  random item. Offer a free path or a direct purchase instead.
- The server rolls the result, never the client.

## Finish checklist

- [ ] All IDs and grants live in one server config.
- [ ] Prices come from `GetProductInfoAsync`.
- [ ] Pass perks are applied on join and on server-side purchase finish.
- [ ] Exactly one `ProcessReceipt`, which checks history, grants, saves,
      then returns `PurchaseGranted`; every failure returns `NotProcessedYet`.
- [ ] Running the handler twice for one `PurchaseId` grants once.
- [ ] Paid random items show full odds first and respect the policy check.
- [ ] The dev approved every product change and real-Robux test.
