# NewsNext Registry

Public Source Providers for NewsNext. This repository is
developed beside the public [NewsNext](https://github.com/newsnext/newsnext) checkout.

Every registry must contain a `sources/` directory at the repository root. The
CLI reads this directory directly; no index file or build step is required.

- `sources/<provider>.json`, `sources/<provider>.js`, or
  `sources/<provider>/index.js` (also `.mjs`): original Source Providers.

Provider IDs come from file or directory names. Definitions follow the public SDK schemas.
Do not include credentials or personal configuration.

This is a resource repository, with no package manifest, dependencies, or runtime
entry. Source modules use the SDK supplied by their host. Hosts explicitly import
the Providers they need and resolve them with `@newsnext/sdk/source/registry`;
registry membership alone never bundles a Provider.

The NewsNext CLI preconfigures this repository as `official` at
`https://github.com/newsnext/registry`; no manual registration is needed.
`newsnext registry update official` downloads and registers all its Sources.
Use `newsnext registry list official` to inspect available Providers.

Validation belongs to the public NewsNext checkout. With
that checkout beside this repository, run this command from its root:

```sh
bun run registry:validate
```

Validation resolves Source definitions without fetching data or generating files.
Registration and execution belong to the host.
