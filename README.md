# pebabion.com

[![Deploy](https://github.com/pebabion/pebabion.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/pebabion/pebabion.github.io/actions/workflows/deploy.yml)

Source code for [pebabion.com](https://pebabion.com) 🤓, built with [Astro](https://astro.build) and Tailwind CSS.

## Develop

Needs Node 22.12 or later.

```sh
npm install
npm run dev      # http://localhost:4321, drafts included
npm run build    # type-check and build to dist/
npm run preview  # serve dist/
```

## Write a post

Add `src/content/blog/<slug>.md`, or `src/content/blog/<slug>/index.md` with
images beside it. The post lives at `/blog/<slug>/`.

```md
---
title: My post
description: One line for the post list, RSS and link previews.
pubDate: 2026-10-01
updatedDate: 2026-10-02 # optional
tags: [data, ai]        # optional
heroImage: ./cover.png  # optional
draft: true             # optional; drafts show in dev only
---

Post body in markdown.
```

`src/content.config.ts` checks the frontmatter, so a missing or wrong field
fails the build.

## Deploy

Pushing to `dev` builds the site and deploys it to GitHub Pages. Pull requests
build but don't deploy.
