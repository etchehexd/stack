/**
 * Database types.
 *
 * These are hand-maintained to match `supabase/schema.sql`. Once your Supabase
 * project exists you can regenerate them from the live schema instead:
 *
 *   npm run gen:types
 *
 * (see package.json — it wraps `supabase gen types typescript --project-id ...`)
 * Regenerating overwrites this file, which is fine: it is the source of truth
 * for query typing everywhere else in the app.
 */

export type MediaType = "anime" | "manga" | "light_novel";

export type LibraryStatus =
  | "watching"
  | "completed"
  | "planning"
  | "on_hold"
  | "dropped"
  | "repeating";

export type ActivityKind =
  | "rated"
  | "status_changed"
  | "progress"
  | "completed"
  | "started"
  | "list_created"
  | "review_posted"
  | "favorited"
  | "followed";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface AniListTag {
  name: string;
  rank: number | null;
  isSpoiler: boolean;
}

export interface UserPreferences {
  /** Opt-in single-number "Overall" sort. OFF by default — see DECISIONS.md. */
  overall_sort_enabled: boolean;
  theme: "dark" | "light" | "system";
  adult_content: boolean;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          banner_url: string | null;
          bio: string | null;
          preferences: UserPreferences;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          banner_url?: string | null;
          bio?: string | null;
          preferences?: UserPreferences;
          is_private?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      titles: {
        Row: {
          id: string;
          anilist_id: number;
          mal_id: number | null;
          media_type: MediaType;
          format: string | null;
          title_romaji: string | null;
          title_english: string | null;
          title_native: string | null;
          synonyms: string[];
          synopsis: string | null;
          cover_image: string | null;
          cover_image_large: string | null;
          cover_color: string | null;
          banner_image: string | null;
          season: string | null;
          season_year: number | null;
          start_date: string | null;
          end_date: string | null;
          status: string | null;
          episodes: number | null;
          duration: number | null;
          chapters: number | null;
          volumes: number | null;
          studios: string[];
          authors: string[];
          genres: string[];
          tags: AniListTag[];
          average_score: number | null;
          popularity: number | null;
          favourites: number | null;
          is_adult: boolean;
          country_of_origin: string | null;
          source: string | null;
          site_url: string | null;
          next_airing_at: string | null;
          next_airing_ep: number | null;
          synced_at: string;
          created_at: string;
          search_text: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["titles"]["Row"],
          "id" | "created_at" | "search_text"
        > & { id?: string };
        Update: Partial<Database["public"]["Tables"]["titles"]["Insert"]>;
        Relationships: [];
      };
      title_relations: {
        Row: {
          id: number;
          source_id: string;
          target_id: string;
          relation_type: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["title_relations"]["Row"],
          "id"
        >;
        Update: Partial<
          Database["public"]["Tables"]["title_relations"]["Insert"]
        >;
        Relationships: [];
      };
      ratings: {
        Row: {
          user_id: string;
          title_id: string;
          bucket: RatingBucket;
          /** 0-based position inside the bucket, ascending (0 = worst). */
          ord: number;
          /** Derived from ord by respread_bucket(). Never write this directly. */
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title_id: string;
          bucket: RatingBucket;
          ord?: number;
          score?: number;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Insert"]>;
        Relationships: [];
      };
      library_entries: {
        Row: {
          user_id: string;
          title_id: string;
          status: LibraryStatus;
          progress: number;
          progress_volumes: number | null;
          repeat_count: number;
          started_at: string | null;
          completed_at: string | null;
          notes: string | null;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          title_id: string;
          status?: LibraryStatus;
          progress?: number;
          progress_volumes?: number | null;
          repeat_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          is_private?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["library_entries"]["Insert"]
        >;
        Relationships: [];
      };
      favorites: {
        Row: {
          user_id: string;
          title_id: string;
          position: number;
          created_at: string;
        };
        Insert: { user_id: string; title_id: string; position?: number };
        Update: Partial<Database["public"]["Tables"]["favorites"]["Insert"]>;
        Relationships: [];
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          slug: string;
          is_public: boolean;
          is_ranked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          slug: string;
          is_public?: boolean;
          is_ranked?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["lists"]["Insert"]>;
        Relationships: [];
      };
      list_items: {
        Row: {
          list_id: string;
          title_id: string;
          position: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          list_id: string;
          title_id: string;
          position?: number;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["list_items"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          title_id: string;
          body: string;
          has_spoilers: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title_id: string;
          body: string;
          has_spoilers?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: { follower_id: string; followee_id: string; created_at: string };
        Insert: { follower_id: string; followee_id: string };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
        Relationships: [];
      };
      activity: {
        Row: {
          id: number;
          user_id: string;
          title_id: string | null;
          kind: ActivityKind;
          payload: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          title_id?: string | null;
          kind: ActivityKind;
          payload?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["activity"]["Insert"]>;
        Relationships: [];
      };
      airing_schedule: {
        Row: {
          id: number;
          title_id: string;
          episode: number;
          airing_at: string;
          created_at: string;
        };
        Insert: {
          id: number;
          title_id: string;
          episode: number;
          airing_at: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["airing_schedule"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      facets: {
        Row: { kind: string; value: string; n: number };
        Relationships: [];
      };
    };
    Functions: {
      search_titles: {
        Args: {
          p_query?: string | null;
          p_media_types?: MediaType[] | null;
          p_formats?: string[] | null;
          p_exclude_formats?: string[] | null;
          p_statuses?: string[] | null;
          p_exclude_statuses?: string[] | null;
          p_include_genres?: string[] | null;
          p_exclude_genres?: string[] | null;
          p_include_studios?: string[] | null;
          p_exclude_studios?: string[] | null;
          p_year_min?: number | null;
          p_year_max?: number | null;
          p_season?: string | null;
          p_count_min?: number | null;
          p_count_max?: number | null;
          p_score_min?: number | null;
          p_score_max?: number | null;
          p_include_adult?: boolean;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: SearchResult[];
      };
      user_stats: { Args: { p_user_id: string }; Returns: UserStats };
      recommendations: {
        Args: {
          p_user_id: string;
          p_media_type?: MediaType | null;
          p_limit?: number;
        };
        Returns: Recommendation[];
      };
      taste_compatibility: {
        Args: { p_a: string; p_b: string };
        Returns: TasteCompatibility;
      };
      place_rating: {
        Args: { p_title_id: string; p_bucket: string; p_position: number };
        Returns: number;
      };
      seed_rating: {
        Args: { p_title_id: string; p_score: number };
        Returns: number;
      };
      unrate: {
        Args: { p_title_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      media_type: MediaType;
      library_status: LibraryStatus;
      activity_kind: ActivityKind;
    };
    CompositeTypes: Record<never, never>;
  };
}

/* -------------------------------------------------------------------------- */
/* RPC return shapes                                                          */
/* -------------------------------------------------------------------------- */

export interface SearchResult {
  id: string;
  anilist_id: number;
  media_type: MediaType;
  format: string | null;
  title_romaji: string | null;
  title_english: string | null;
  title_native: string | null;
  cover_image_large: string | null;
  cover_color: string | null;
  banner_image: string | null;
  season: string | null;
  season_year: number | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  studios: string[];
  authors: string[];
  genres: string[];
  average_score: number | null;
  popularity: number | null;
  synopsis: string | null;
  relevance: number;
  total_count: number;
}

/** Matches the ratings_bucket_valid constraint in schema.sql. */
export type RatingBucket = "loved" | "fine" | "bad";

export interface UserStats {
  total_entries: number;
  anime_count: number;
  manga_count: number;
  ln_count: number;
  completed: number;
  watching: number;
  planning: number;
  dropped: number;
  on_hold: number;
  episodes_watched: number;
  minutes_watched: number;
  chapters_read: number;
  volumes_read: number;
  rated_count: number;
  avg_score: number | null;
  buckets: {
    loved: number;
    fine: number;
    bad: number;
  };
  top_genres: { name: string; count: number }[];
  top_studios: { name: string; count: number }[];
}

export interface Recommendation {
  id: string;
  media_type: MediaType;
  format: string | null;
  title_romaji: string | null;
  title_english: string | null;
  cover_image_large: string | null;
  cover_color: string | null;
  average_score: number | null;
  popularity: number | null;
  genres: string[];
  season_year: number | null;
  match_score: number;
}

export interface TasteCompatibility {
  shared_count: number;
  compatibility: number | null;
  score_gap: number | null;
}

/* Convenience aliases used throughout the app ------------------------------ */
export type Title = Database["public"]["Tables"]["titles"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Rating = Database["public"]["Tables"]["ratings"]["Row"];
export type LibraryEntry =
  Database["public"]["Tables"]["library_entries"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type ListRow = Database["public"]["Tables"]["lists"]["Row"];
export type AiringEntry = Database["public"]["Tables"]["airing_schedule"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];
