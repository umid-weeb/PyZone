# Contributing

Thanks for contributing to PyZone.

## Development flow
1. Fork or create a branch from the default branch.
2. Keep changes focused and small.
3. Use `.env.example` to configure local environment (never commit real secrets).
4. Run relevant checks before submitting:
   - `npm --prefix arena run build`
   - `python -m pytest backend/tests -q`
5. Open a Pull Request using the PR template.

## Commit & PR guidelines
- Use clear commit messages.
- Reference related issue numbers.
- Include test/build notes in the PR description.
- Ensure CI is green before requesting review.

## Security
- Do not commit credentials, tokens, or `.env` files.
- If you find leaked keys, rotate them immediately and report in the PR.
