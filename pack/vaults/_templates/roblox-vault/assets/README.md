# Asset registry

`registry.json` lists every asset ID the game uses. It starts as an empty list.
Add one object per asset. JSON has no comments, so the example lives here:

```jsonc
[
  {
    "id": "rbxassetid://0000000000",   // the asset ID used in code
    "source": "<where it came from: made by <OWNER>, Creator Store, a URL>",
    "licence": "<the licence or terms it is used under>"
  }
]
```

Every field is required. An asset with no known licence does not go in the game.
