import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  // Each post is either `blog/<slug>.md` or `blog/<slug>/index.md`, with its
  // images next to it.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      heroImage: image().optional(),
      // Drafts show up in `npm run dev` but not in production builds.
      draft: z.boolean().default(false),
    }),
});

export const collections = { blog };
