# NewsNext Registry

Public Sources, Plugins, Actions, and Insights for NewsNext. This repository is
also the `registry/` submodule of [NewsNext](https://github.com/newsnext/newsnext).

- `sources/<provider>.json`, `sources/<provider>.js`, or
  `sources/<provider>/index.js` (also `.mjs`): original Source Providers.
- `actions/<id>/`: `action.json` and `index.mjs`, plus supporting files.
- `insights/<id>/`: `insight.json`, optionally `data.mjs`, `index.html`, and assets.
- `plugins/<id>/`: `plugin.json` and optional `sources/`, `actions/`, `insights/`
  using the same layouts. Plugin resources remain scoped to their plugin.

IDs come from file or directory names. Manifests follow the public SDK schemas.
Do not include credentials or personal configuration.

For development, clone NewsNext with `--recurse-submodules`, run `bun install`
in its root, then run:

```sh
bun --filter=@newsnext/registry run validate
bun --filter=@newsnext/registry run build
bun --filter=@newsnext/registry run typecheck
```

The SDK and TypeScript configuration are supplied by the NewsNext workspace;
no published SDK package is required. Validation resolves Source definitions
without fetching their data and checks standalone and plugin manifests. Action
and Insight modules are cataloged without executing them.

Build generates `catalog.json` with repository-relative resource paths and
manifests for all four resource kinds. Plugin entries include their own resource
catalogs. `@newsnext/registry/catalog` exposes this index. It is discovery metadata;
installation and execution belong to the host. Build also generates `sources.js`
and `sources.d.ts` for the extension's bundled standalone Sources. Plugins,
Actions, and Insights are installed separately, not bundled into the extension.
Do not edit generated files directly.
