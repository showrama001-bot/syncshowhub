import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_trending_movies",
  title: "List trending movies",
  description: "List the top-rated / featured movies from SyncShow, ordered by IMDb rating.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Max number of results."),
    featured_only: z.boolean().default(false).describe("If true, only return featured movies."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, featured_only }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("movies")
      .select("id,title,year,genre,imdb_rating,poster_url,featured")
      .order("imdb_rating", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (featured_only) q = q.eq("featured", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { movies: data ?? [] },
    };
  },
});