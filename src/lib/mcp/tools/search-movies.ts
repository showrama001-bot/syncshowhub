import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_movies",
  title: "Search movies",
  description: "Search SyncShow's movie catalog by title. Returns matching movies with id, title, year, genre, rating, and poster.",
  inputSchema: {
    query: z.string().min(1).describe("Title or partial title to search for."),
    limit: z.number().int().min(1).max(50).default(10).describe("Max number of results."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("movies")
      .select("id,title,year,genre,imdb_rating,poster_url,description,category")
      .ilike("title", `%${query}%`)
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { movies: data ?? [] },
    };
  },
});