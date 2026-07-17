## What changed

<!-- Describe the user-visible outcome and why it belongs in Browser AI Kit. -->

## Verification

- [ ] `pnpm check`
- [ ] `pnpm format:check`
- [ ] Tests added or updated where behavior changed
- [ ] Tested in a supported Chrome build when native API behavior changed
- [ ] Desktop and mobile layouts checked when UI changed

Chrome version, operating system, flags, and API availability state:

## Release

- [ ] Changeset added for a user-visible package change
- [ ] No changeset needed (documentation or repository maintenance only)

## Security and compatibility

- [ ] Browser globals remain SSR-safe
- [ ] Abort, cleanup, availability, and download states are handled
- [ ] WebMCP tools re-check authorization and validate inputs where applicable
- [ ] No secrets or private data are included
