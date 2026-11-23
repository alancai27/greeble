---
name: roblox-datastore-safety
description: Use when saving or loading player data with DataStoreService in a Roblox game, i.e. "save player coins", "players lost their progress", "items are duplicating", "add a new field to the save", or "review my data script". Builds session-locked, retried, autosaved saves that flush on BindToClose, carry a schema version and migrate old data, with no loss and no dupes.
---

# Data store safety: one owner, careful writes

Player data is lost when a write fails silently, and duplicated when two
servers both think they own a player. This skill prevents both.

Code style rules are in `<VAULTS>/Roblox Knowledge/rules/code.md`; follow
them. This skill covers only the save path.

## When to use it

- Any script calls `GetDataStore`, `GetAsync`, `SetAsync` or `UpdateAsync`.
- The dev reports lost progress, rollbacks or duplicated items.
- The save format is changing.

## Steps, in order

1. **One store, one key per player.** Use `DataStoreService:GetDataStore`
   with a fixed name and a key like `"Player_" .. userId`. Keep everything
   that must change together under that one key. Check the encoded size
   with `HttpService:JSONEncode`; one value must stay under the 4 MB limit.
2. **Shape the record.** Store `{ schema = N, data = {...} }`. Plain
   tables, string keys, numbers, strings and booleans only. No Instances,
   no mixed arrays.
3. **Load with a session lock.** Load inside `UpdateAsync`, not
   `GetAsync`. In the callback, look at the lock stored with the value
   (in the record, or in metadata set with `DataStoreSetOptions:SetMetadata`).
   - No lock, or a lock older than the expiry: write your own lock
     (`game.JobId` or `HttpService:GenerateGUID()`, plus a timestamp) and
     return the value.
   - Someone else's live lock: return `nil` to cancel, wait, and try
     again a few times. If it is still held, keep the player on defaults
     marked read-only and tell them their data is loading.
   The callback can't yield and may run more than once, so it only
   reads its arguments and returns.
4. **Migrate on load.** If `schema` is below current, run each migration
   step in order (`1 -> 2`, `2 -> 3`) on the loaded table, then set
   `schema` to current. Fill missing fields from defaults. Never delete a
   field you don't understand; a newer server may have written it.
5. **Never save what you didn't load.** If the load failed, mark the
   profile errored and skip every later write for it, so defaults can't
   overwrite real data.
6. **Write with `UpdateAsync`.** Each save checks the lock is still yours
   and returns the new record; if not, return `nil` and stop saving this
   player. Don't use `SetAsync` for player data.
7. **Retry with backoff.** Wrap every call in `pcall`. Retry failures that
   can be temporary with growing delays plus random jitter, capped in both
   delay and attempts. Don't retry bad-input errors. Keep one queue per
   key so an old retry can't land after a newer save. A failed call may
   still have written.
8. **Watch the budget.** Before non-urgent writes, check
   `DataStoreService:GetRequestBudgetForRequestType`. Skip an autosave
   tick rather than queue past the limit.
9. **Autosave.** Save every few minutes, not on each change, with each
   player at a random offset so saves spread out. The interval must be
   well under the lock expiry; each save refreshes the lock.
10. **Save on leave.** On `Players.PlayerRemoving`, do a final save that
    also clears the lock, then drop the player from memory.
11. **Save on shutdown.** In `game:BindToClose`, save every remaining
    player in parallel and return only when all are done. The server waits
    at most 30 seconds. Skip real saves when `RunService:IsStudio()` unless
    the dev wants Studio to write.
12. **Purchases are checkpoints.** After granting anything paid, save
    straight away. See the `roblox-monetization` skill.

## Ask first

Data stores are shared with the live game. Before running anything that
writes, deletes or migrates real keys from Studio or Open Cloud, ask the
dev. Testing against a separate store name is the default.

## Finish checklist

- [ ] One store name and one key per player; size checked.
- [ ] Record has a `schema` number and ordered migration steps.
- [ ] Load takes a session lock inside `UpdateAsync`; held locks are retried,
      then handled read-only.
- [ ] A failed load blocks all saves for that player.
- [ ] Every write is `UpdateAsync`, checks the lock, and is in `pcall` with
      capped, jittered backoff, one queue per key.
- [ ] Autosave interval is under the lock expiry and checks the budget.
- [ ] `PlayerRemoving` saves and releases; `BindToClose` saves everyone
      in parallel and waits.
- [ ] No writes to live data were made without asking the dev.
