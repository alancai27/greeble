---
name: roblox-secure-remotes
description: Use when writing or reviewing any RemoteEvent, UnreliableRemoteEvent or RemoteFunction in a Roblox game, i.e. "add a remote for buying", "the client tells the server it hit someone", "is this remote exploitable", or "players are spamming this event". Makes every handler server-authoritative with type, range, ownership and rate checks, and no trusted client values.
---

# Secure remotes: the server decides

A remote is a door into the server that anyone can knock on, with any
arguments, as often as they like. Only the first `player` argument is
filled in by the engine. Treat everything after it as hostile.

Style and naming rules for the code itself live in the Roblox Knowledge
vault at `<VAULTS>/Roblox Knowledge/rules/code.md`. Follow that file; this
skill only covers what a remote handler must check.

## When to use it

- A new remote is being added, or an existing handler is being changed.
- The dev asks whether something can be exploited, or reports cheating.
- A client script currently sends a price, damage, reward or position that
  the server applies as-is.

## Steps, in order, for each handler

1. **List the remotes.** Search the place for `RemoteEvent`,
   `UnreliableRemoteEvent` and `RemoteFunction` and each
   `OnServerEvent` / `OnServerInvoke` handler. Work through them one at a time.
2. **Shrink the request.** The client should send intent only: "buy item
   `id`", "fire at `target`". If it sends a price, damage amount, currency
   total, cooldown or reward, delete that argument and look the value up on
   the server from config in `ServerScriptService` or `ServerStorage`.
3. **Check types first.** Before any other use, check each argument with
   `typeof`. Reject the call on the first mismatch; don't coerce. For
   strings and tables, also cap length and entry count so a huge payload is
   cheap to refuse.
4. **Check numbers are real.** NaN passes every `<`/`>` test the wrong way.
   Reject any number that fails `math.isfinite`, then check it is in range
   and, where it should be, an integer.
5. **Check Instances properly.** An Instance argument can be any object the
   client can see. Confirm `IsA` the class you expect and
   `IsDescendantOf` the folder it must come from. Objects that exist only on
   the sender arrive as `nil`, so handle `nil`.
6. **Check permission and ownership.** Ask: may this player do this now?
   Alive, close enough, owns the item or tool, not on cooldown, has the
   funds, in the right round. Read the answers from server state, never
   from the arguments.
7. **Rate-limit on the server.** Keep a per-player budget (a token bucket
   or a timestamp per action) in a server table and drop calls over it.
   Client-side debounces are only UX. Clear the entry on `PlayerRemoving`.
8. **Act, then broadcast.** Change server state, then tell clients. If the
   server relays one player's input to others with `FireAllClients` or
   `FireClient`, it validates and rate-limits it first.
9. **Fail quietly.** A rejected call returns or does nothing. Don't error,
   don't kick on the first bad packet; log a counter if the dev wants
   detection.

## RemoteFunction notes

- Prefer a RemoteEvent unless the client really needs a reply.
- Avoid `InvokeClient`: the server thread hangs if the client never
  answers and errors if the client errors or leaves. Use a RemoteEvent back.
- `OnServerInvoke` follows every step above, and returns a small,
  server-built result.

## UnreliableRemoteEvent notes

- Use it only for data that is fine to lose: cosmetic, or replaced by the
  next message. Never for purchases, damage or inventory.
- Messages can be dropped or arrive out of order. Send a sequence number and
  ignore anything older than the last one handled.

## Movement and physics

Clients own their character's physics and nearby unanchored parts. A
position the client reports, or its character's position, can be faked.
Check distance against elapsed time with some slack for latency, rather
than trusting a single reading.

## Finish checklist

- [ ] Every handler was read, not just the new one.
- [ ] No handler applies a price, damage, reward or total sent by the client.
- [ ] Every argument is `typeof`-checked before use, with size caps on
      strings and tables.
- [ ] Numbers are finite, in range and integer where needed.
- [ ] Instance arguments are class- and location-checked, `nil` handled.
- [ ] Permission comes from server state.
- [ ] Each remote has a server-side rate limit, cleaned up on leave.
- [ ] No `InvokeClient`; no critical data over an UnreliableRemoteEvent.
- [ ] Tell the dev, in a line or two, which remotes changed and why.
