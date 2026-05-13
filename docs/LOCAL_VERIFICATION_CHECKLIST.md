# Local Verification Checklist

Use this checklist before sending UI changes back to the user.

## Thai Copy Guard

- Run `npm run check:mojibake` after editing Thai UI text, docs, or labels.
- Fix any flagged text before committing.

## Next Dev Server Guard

- `npm run build` writes to `.next`, the same cache directory used by `next dev`.
- If a dev server is running while `npm run build` runs, restart the dev server before checking `localhost`.
- If the page renders as plain HTML, verify the CSS asset first:
  - HTML should return `200`.
  - `/_next/static/css/app/layout.css?...` should return `200`.
  - The CSS should contain Tailwind utilities such as `.flex`.

## Suggested Local Flow

1. Run `npm run check:mojibake`.
2. Run `npm run build`.
3. Stop any process listening on port `3000`.
4. Start `npm run dev -- --hostname 127.0.0.1 --port 3000`.
5. Refresh the changed page and confirm the UI is styled.
