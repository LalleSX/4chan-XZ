# 4chan XZ

**This repo is work in progress!** Use the build from the [repo this is forked from](https://github.com/ccd0/4chan-x) in the meantime.

PR to upstream: <https://github.com/ccd0/4chan-x/pull/3341>.

The 4chan XT project is a migration of 4chan X from coffeescript to TypeScript/JavaScript. It is named XT both as a continuation of eXTended, and a T for TypeScript. The goals of this project is to first get a working bundle from js/ts files, and then gradually convert js files to ts and add types as needed.

## TODO

- [] add types to all files

- [] make project use strict mode

- [] switch from fontawesome & pictures to svg icons.

- [] add tests

- [] add vite for development

- [] make it a chrome & firefox extension.

## Building the project

**Note:** THIS PROJECT IS FAR FROM BEING DONE. DO NOT USE IT FOR NON-DEVELOPMENT YET.

```npm
pnpm install
pnpm run build
```

or as i prefer

```bash
make sneed
```

## What might be added on

- [] add React, or Vue

- [] add the auto-captcha solver to BTFO jannies
