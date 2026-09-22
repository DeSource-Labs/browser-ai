# Security policy

Browser AI Kit runs model interactions in the user's browser, but application code, prompts, tool implementations, and rendered output still require normal security review.

## Supported versions

Security fixes are released for the latest published minor version of each package.

## Report a vulnerability

Please do not open a public issue. Email [hello@desourcelabs.com](mailto:hello@desourcelabs.com) with:

- the affected package and version;
- a concise description and impact assessment;
- reproduction steps or a minimal repository;
- any known workarounds.

We aim to acknowledge reports within three business days and will coordinate disclosure after a fix is available. Good-faith research that avoids privacy violations, service disruption, and data destruction is welcome.

## Application security notes

- Chrome's built-in AI output is untrusted data. Escape or sanitize it before rendering HTML.
- WebMCP tools can perform application actions. Re-check authentication and authorization inside every `execute` function, validate inputs, expose the least data possible, and use accurate tool annotations.
- Do not place secrets in prompts, client bundles, tool descriptions, or client-side configuration.
- Browser AI Kit does not transmit prompts to a DeSource Labs service. Chrome controls model installation and execution; review Chrome and your organization's policies for your deployment.
