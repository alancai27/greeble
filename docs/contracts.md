# Contracts

The shared types and routes that more than one area depends on. Leads write
this file. Leads paste the relevant lines into each issue, so workers never
need to open it.

Keep each contract small and exact. Change one only as described in
`agents/lead.md`.

## Data types

```ts
// example
type Item = {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string; // ISO 8601
};
```

## Routes

| Method | Path | Request body | Response |
|--------|------|--------------|----------|
| GET    | /api/items | none | `Item[]` |
| POST   | /api/items | `{ title: string }` | `Item` |

## Environment variables

| Name | Used by | Notes |
|------|---------|-------|
|      |         |       |
