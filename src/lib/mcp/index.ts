import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchMovies from "./tools/search-movies";
import getMovie from "./tools/get-movie";
import listTrending from "./tools/list-trending";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "syncshow-mcp",
  title: "SyncShow MCP",
  version: "0.1.0",
  instructions:
    "Tools for SyncShow, a streaming platform. Use `search_movies` to find movies by title, `get_movie` to fetch full details by id, and `list_trending_movies` to browse top-rated titles.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchMovies, getMovie, listTrending],
});