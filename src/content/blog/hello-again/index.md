---
title: Hello again
description: The site is back, now with a blog.
pubDate: 2026-09-30
tags: [meta]
draft: true
---

This site sat untouched from October 2022 until now. It's been rebuilt with
[Astro](https://astro.build) and Tailwind, and it has a blog.

## How posts work

Each post is a markdown file in `src/content/blog/`. Put images next to the
post and link them with a relative path:

```md
![A diagram](./diagram.png)
```

Code blocks get syntax highlighting:

```python
def hello(name: str) -> str:
    return f"Hello, {name}!"
```

Set `draft: true` in the frontmatter to keep a post out of the live site.
