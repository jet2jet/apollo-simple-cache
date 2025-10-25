# Changelog

## v0.4.0

- Add `addTypenameToDocument` option to SimpleDocumentCache and set default to true
- Remove 'npm' from 'engines' field because it is only necessary for CI
  - This enables to use `npm` version 10.x for dependents

## v0.3.0

Note: This version changes dependency for v4 version of `@apollo/client` to non-alpha version and changes codes around type definitions, but these should not be breaking changes.

- Support Apollo Client v4.0.0
- Fix `exports` field in package.json
- Fix type definition files for CommonJS (changed `*.d.mts` to `*.d.cts`)

## v0.2.3

Fix a bug for modified proxy object (in case of missing)

## v0.2.2

Fix some bugs, including dirty marking and object reference

## v0.2.1

Fix for cache modification, in case of field deletion

## v0.2.0

Support Apollo Client v4

## v0.1.2

Fix field modification process

## v0.1.1

Change watcher management for SimpleDocumentCache to improve speed

## v0.1.0

Released as a non-experimental but alpha or beta version.
