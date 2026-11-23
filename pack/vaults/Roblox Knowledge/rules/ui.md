# UI rules

- One spec produces three outputs (preview, UI file, builder), so they can't drift apart.
- Every panel and button gets a depth stack: a slightly blue shadow, a gradient face, a top highlight, and one outline thickness everywhere. Mixed outline thickness is the biggest AI-UI giveaway.
- No emoji; icons are generated.
- Check at four screen sizes: thumb-sized buttons, nothing touching, centred items within 1.5 px, readable text size, no stray boxes.
- Build with plain Roblox UI instances plus client controllers, not Fusion: Claude can inspect and fix them through the MCP.
- Each game keeps a style guide and reference screenshots.
- Responsive layout, safe areas and motion are covered by the `roblox-ui-review` skill.

The `roblox-ui-review` skill ships in this pack at `<CLAUDE>/skills/roblox-ui-review/`.
