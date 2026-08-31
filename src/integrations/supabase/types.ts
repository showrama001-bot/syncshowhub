export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      active_stream: {
        Row: {
          created_at: string
          host_id: string | null
          id: number
          movie_id: string | null
          poster_url: string | null
          status: string
          stream_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          host_id?: string | null
          id?: number
          movie_id?: string | null
          poster_url?: string | null
          status?: string
          stream_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          host_id?: string | null
          id?: number
          movie_id?: string | null
          poster_url?: string | null
          status?: string
          stream_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_system: {
        Row: {
          break_enabled: boolean
          break_queue: Json
          break_trigger_seconds: number
          created_at: string
          global_scripts: string
          grid_banner_script: string
          header_banner_script: string
          hero_banner_link: string | null
          hero_banner_url: string | null
          hook_duration_seconds: number
          hook_image_url: string | null
          id: number
          master_enabled: boolean
          network_enabled: boolean
          pause_banner_link: string | null
          pause_banner_url: string | null
          postroll_link: string | null
          postroll_url: string | null
          preroll_link: string | null
          preroll_url: string | null
          room_takeover_url: string | null
          skip_seconds: number
          timeline_enabled: boolean
          under_player_script: string
          updated_at: string
          vip_enabled: boolean
        }
        Insert: {
          break_enabled?: boolean
          break_queue?: Json
          break_trigger_seconds?: number
          created_at?: string
          global_scripts?: string
          grid_banner_script?: string
          header_banner_script?: string
          hero_banner_link?: string | null
          hero_banner_url?: string | null
          hook_duration_seconds?: number
          hook_image_url?: string | null
          id?: number
          master_enabled?: boolean
          network_enabled?: boolean
          pause_banner_link?: string | null
          pause_banner_url?: string | null
          postroll_link?: string | null
          postroll_url?: string | null
          preroll_link?: string | null
          preroll_url?: string | null
          room_takeover_url?: string | null
          skip_seconds?: number
          timeline_enabled?: boolean
          under_player_script?: string
          updated_at?: string
          vip_enabled?: boolean
        }
        Update: {
          break_enabled?: boolean
          break_queue?: Json
          break_trigger_seconds?: number
          created_at?: string
          global_scripts?: string
          grid_banner_script?: string
          header_banner_script?: string
          hero_banner_link?: string | null
          hero_banner_url?: string | null
          hook_duration_seconds?: number
          hook_image_url?: string | null
          id?: number
          master_enabled?: boolean
          network_enabled?: boolean
          pause_banner_link?: string | null
          pause_banner_url?: string | null
          postroll_link?: string | null
          postroll_url?: string | null
          preroll_link?: string | null
          preroll_url?: string | null
          room_takeover_url?: string | null
          skip_seconds?: number
          timeline_enabled?: boolean
          under_player_script?: string
          updated_at?: string
          vip_enabled?: boolean
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      client_error_logs: {
        Row: {
          area: string
          context: Json
          created_at: string
          fingerprint: string | null
          id: string
          level: string
          message: string
          request_url: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          source: string
          stack: string | null
          status_code: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          area?: string
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          level?: string
          message: string
          request_url?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          source?: string
          stack?: string | null
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          area?: string
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          level?: string
          message?: string
          request_url?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          source?: string
          stack?: string | null
          status_code?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      community_uploads: {
        Row: {
          backdrop_url: string | null
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          episode_number: number | null
          episode_title: string | null
          genre: string | null
          id: string
          imdb_rating: number | null
          kind: string
          poster_url: string | null
          published_episode_id: string | null
          published_movie_id: string | null
          rating: number | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          season_number: number | null
          series_tmdb_id: number | null
          source_type: string | null
          status: string
          stream_url: string | null
          telegram_file_id: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
          uploader_id: string
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          episode_number?: number | null
          episode_title?: string | null
          genre?: string | null
          id?: string
          imdb_rating?: number | null
          kind?: string
          poster_url?: string | null
          published_episode_id?: string | null
          published_movie_id?: string | null
          rating?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          season_number?: number | null
          series_tmdb_id?: number | null
          source_type?: string | null
          status?: string
          stream_url?: string | null
          telegram_file_id?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          uploader_id: string
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          episode_number?: number | null
          episode_title?: string | null
          genre?: string | null
          id?: string
          imdb_rating?: number | null
          kind?: string
          poster_url?: string | null
          published_episode_id?: string | null
          published_movie_id?: string | null
          rating?: number | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          season_number?: number | null
          series_tmdb_id?: number | null
          source_type?: string | null
          status?: string
          stream_url?: string | null
          telegram_file_id?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          uploader_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_uploads_published_movie_id_fkey"
            columns: ["published_movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      device_bans: {
        Row: {
          created_at: string
          created_by: string | null
          device_fingerprint: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_fingerprint: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_fingerprint?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string
          doodstream_url: string | null
          episode_number: number
          id: string
          intro_end_seconds: number | null
          intro_start_seconds: number | null
          season_id: string
          stream_sources: Json
          stream_url: string | null
          streamtape_url: string | null
          subtitles: Json
          title: string
          voe_sx_url: string | null
        }
        Insert: {
          created_at?: string
          doodstream_url?: string | null
          episode_number: number
          id?: string
          intro_end_seconds?: number | null
          intro_start_seconds?: number | null
          season_id: string
          stream_sources?: Json
          stream_url?: string | null
          streamtape_url?: string | null
          subtitles?: Json
          title: string
          voe_sx_url?: string | null
        }
        Update: {
          created_at?: string
          doodstream_url?: string | null
          episode_number?: number
          id?: string
          intro_end_seconds?: number | null
          intro_start_seconds?: number | null
          season_id?: string
          stream_sources?: Json
          stream_url?: string | null
          streamtape_url?: string | null
          subtitles?: Json
          title?: string
          voe_sx_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          attachment_id: string | null
          attachment_kind: string | null
          attachment_thumb: string | null
          attachment_title: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          attachment_id?: string | null
          attachment_kind?: string | null
          attachment_thumb?: string | null
          attachment_title?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          attachment_id?: string | null
          attachment_kind?: string | null
          attachment_thumb?: string | null
          attachment_title?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: []
      }
      host_follows: {
        Row: {
          created_at: string
          follower_id: string
          host_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          host_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          host_id?: string
          id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_logo: string | null
          away_score: number | null
          away_team: string
          created_at: string
          created_by: string | null
          home_logo: string | null
          home_score: number | null
          home_team: string
          id: string
          kickoff_at: string
          league: string | null
          source_type: string
          status: string
          stream_url: string | null
        }
        Insert: {
          away_logo?: string | null
          away_score?: number | null
          away_team: string
          created_at?: string
          created_by?: string | null
          home_logo?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          kickoff_at: string
          league?: string | null
          source_type?: string
          status?: string
          stream_url?: string | null
        }
        Update: {
          away_logo?: string | null
          away_score?: number | null
          away_team?: string
          created_at?: string
          created_by?: string | null
          home_logo?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff_at?: string
          league?: string | null
          source_type?: string
          status?: string
          stream_url?: string | null
        }
        Relationships: []
      }
      missing_stream_submissions: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          note: string | null
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          note?: string | null
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          note?: string | null
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_stream_submissions_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      missing_stream_votes: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_stream_votes_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          movie_id: string
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          movie_id: string
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          movie_id?: string
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movie_comments_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      movie_reports: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "movie_reports_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      movies: {
        Row: {
          backdrop_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          doodstream_url: string | null
          duration_minutes: number | null
          featured: boolean
          genre: string | null
          id: string
          imdb_rating: number | null
          intro_end_seconds: number | null
          intro_start_seconds: number | null
          is_admin_upload: boolean
          poster_url: string | null
          provider: string | null
          rating: number | null
          source_type: string
          status: string
          stream_sources: Json
          stream_url: string | null
          streamtape_url: string | null
          subtitles: Json
          title: string
          tmdb_id: number | null
          voe_sx_url: string | null
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doodstream_url?: string | null
          duration_minutes?: number | null
          featured?: boolean
          genre?: string | null
          id?: string
          imdb_rating?: number | null
          intro_end_seconds?: number | null
          intro_start_seconds?: number | null
          is_admin_upload?: boolean
          poster_url?: string | null
          provider?: string | null
          rating?: number | null
          source_type?: string
          status?: string
          stream_sources?: Json
          stream_url?: string | null
          streamtape_url?: string | null
          subtitles?: Json
          title: string
          tmdb_id?: number | null
          voe_sx_url?: string | null
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          doodstream_url?: string | null
          duration_minutes?: number | null
          featured?: boolean
          genre?: string | null
          id?: string
          imdb_rating?: number | null
          intro_end_seconds?: number | null
          intro_start_seconds?: number | null
          is_admin_upload?: boolean
          poster_url?: string | null
          provider?: string | null
          rating?: number | null
          source_type?: string
          status?: string
          stream_sources?: Json
          stream_url?: string | null
          streamtape_url?: string | null
          subtitles?: Json
          title?: string
          tmdb_id?: number | null
          voe_sx_url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          href: string | null
          id: string
          kind: string
          meta: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          href?: string | null
          id?: string
          kind: string
          meta?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          meta?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      playback_reports: {
        Row: {
          content_id: string
          content_kind: string
          content_title: string | null
          created_at: string
          id: string
          issue: string
          note: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_kind: string
          content_title?: string | null
          created_at?: string
          id?: string
          issue: string
          note?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_kind?: string
          content_title?: string | null
          created_at?: string
          id?: string
          issue?: string
          note?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          favorite_genres: string[]
          favorite_movie: string | null
          id: string
          is_banned: boolean
          permanent_banned: boolean
          suspended_until: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          favorite_genres?: string[]
          favorite_movie?: string | null
          id: string
          is_banned?: boolean
          permanent_banned?: boolean
          suspended_until?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          favorite_genres?: string[]
          favorite_movie?: string | null
          id?: string
          is_banned?: boolean
          permanent_banned?: boolean
          suspended_until?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      reels: {
        Row: {
          created_at: string
          created_by: string
          id: string
          movie_id: string | null
          poster_url: string | null
          source_type: string
          title: string | null
          video_url: string | null
          youtube_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          movie_id?: string | null
          poster_url?: string | null
          source_type: string
          title?: string | null
          video_url?: string | null
          youtube_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          movie_id?: string | null
          poster_url?: string | null
          source_type?: string
          title?: string | null
          video_url?: string | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reels_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_message_id: string | null
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_message_id?: string | null
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_message_id?: string | null
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_message_id_fkey"
            columns: ["reported_message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      room_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "streamer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_invites: {
        Row: {
          created_at: string
          from_user: string
          id: string
          room_id: string
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          room_id: string
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          room_id?: string
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_invites_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "watch_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_kicks: {
        Row: {
          created_at: string
          id: string
          kicked_by: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kicked_by: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kicked_by?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_kicks_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "watch_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          id: string
          joined_at: string
          last_seen_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_seen_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_seen_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          season_number: number
          series_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          season_number: number
          series_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          season_number?: number
          series_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasons_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          backdrop_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          featured: boolean
          genre: string | null
          id: string
          imdb_rating: number | null
          poster_url: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          genre?: string | null
          id?: string
          imdb_rating?: number | null
          poster_url?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          genre?: string | null
          id?: string
          imdb_rating?: number | null
          poster_url?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      server_reports: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          note: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          server: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          note?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          server: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          note?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          server?: string
          status?: string
        }
        Relationships: []
      }
      streamer_applications: {
        Row: {
          bio: string
          created_at: string
          desired_username: string
          id: string
          review_notes: string | null
          reviewer_id: string | null
          sample_link: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio: string
          created_at?: string
          desired_username: string
          id?: string
          review_notes?: string | null
          reviewer_id?: string | null
          sample_link?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string
          created_at?: string
          desired_username?: string
          id?: string
          review_notes?: string | null
          reviewer_id?: string | null
          sample_link?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      streamer_rooms: {
        Row: {
          created_at: string
          current_poster: string | null
          current_video_title: string | null
          current_video_url: string | null
          description: string | null
          id: string
          is_live: boolean
          mode: string
          streamer_id: string
          title: string
          updated_at: string
          username_slug: string
          viewer_count: number
        }
        Insert: {
          created_at?: string
          current_poster?: string | null
          current_video_title?: string | null
          current_video_url?: string | null
          description?: string | null
          id?: string
          is_live?: boolean
          mode?: string
          streamer_id: string
          title?: string
          updated_at?: string
          username_slug: string
          viewer_count?: number
        }
        Update: {
          created_at?: string
          current_poster?: string | null
          current_video_title?: string | null
          current_video_url?: string | null
          description?: string | null
          id?: string
          is_live?: boolean
          mode?: string
          streamer_id?: string
          title?: string
          updated_at?: string
          username_slug?: string
          viewer_count?: number
        }
        Relationships: []
      }
      streamer_uploads: {
        Row: {
          backdrop_url: string | null
          created_at: string
          genre: string | null
          id: string
          overview: string | null
          poster_url: string | null
          rating: number | null
          stream_url: string
          streamer_id: string
          telegram_file_id: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          overview?: string | null
          poster_url?: string | null
          rating?: number | null
          stream_url: string
          streamer_id: string
          telegram_file_id?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          overview?: string | null
          poster_url?: string | null
          rating?: number | null
          stream_url?: string
          streamer_id?: string
          telegram_file_id?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      studio_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "studio_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_invites: {
        Row: {
          created_at: string
          from_user: string
          id: string
          status: string
          stream_id: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          status?: string
          stream_id: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          status?: string
          stream_id?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_invites_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "studio_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_streams: {
        Row: {
          ambient_state: Json
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          mode: string
          poster_url: string | null
          status: string
          stream_url: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
          viewer_count: number
        }
        Insert: {
          ambient_state?: Json
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          mode?: string
          poster_url?: string | null
          status?: string
          stream_url?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
          viewer_count?: number
        }
        Update: {
          ambient_state?: Json
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          mode?: string
          poster_url?: string | null
          status?: string
          stream_url?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
          viewer_count?: number
        }
        Relationships: []
      }
      trailers: {
        Row: {
          created_at: string
          created_by: string | null
          doodstream_url: string | null
          id: string
          kind: string
          movie_id: string | null
          movie_title: string
          series_id: string | null
          streamtape_url: string | null
          updated_at: string
          voe_sx_url: string | null
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doodstream_url?: string | null
          id?: string
          kind?: string
          movie_id?: string | null
          movie_title: string
          series_id?: string | null
          streamtape_url?: string | null
          updated_at?: string
          voe_sx_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doodstream_url?: string | null
          id?: string
          kind?: string
          movie_id?: string | null
          movie_title?: string
          series_id?: string | null
          streamtape_url?: string | null
          updated_at?: string
          voe_sx_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trailers_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trailers_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_channel_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "tv_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      tv_channels: {
        Row: {
          category: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          m3u_url: string
          name: string
          source_type: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          m3u_url: string
          name: string
          source_type?: string
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          m3u_url?: string
          name?: string
          source_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_violations: {
        Row: {
          action_taken: string
          created_at: string
          created_by: string | null
          id: string
          movie_id: string | null
          report_id: string | null
          user_id: string
        }
        Insert: {
          action_taken: string
          created_at?: string
          created_by?: string | null
          id?: string
          movie_id?: string | null
          report_id?: string | null
          user_id: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movie_id?: string | null
          report_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_violations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "movie_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          content_id: string
          content_kind: string
          content_title: string | null
          created_at: string
          genre: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_kind: string
          content_title?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_kind?: string
          content_title?: string | null
          created_at?: string
          genre?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      watch_room_reminders: {
        Row: {
          created_at: string
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_room_reminders_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "watch_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_rooms: {
        Row: {
          content_id: string | null
          content_kind: string
          content_title: string | null
          created_at: string
          host_id: string
          id: string
          participant_count: number
          password_hash: string | null
          poster_url: string | null
          reminder_sent_at: string | null
          scheduled_at: string | null
          status: string
          stream_url: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          content_id?: string | null
          content_kind?: string
          content_title?: string | null
          created_at?: string
          host_id: string
          id?: string
          participant_count?: number
          password_hash?: string | null
          poster_url?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string | null
          status?: string
          stream_url?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          content_id?: string | null
          content_kind?: string
          content_title?: string | null
          created_at?: string
          host_id?: string
          id?: string
          participant_count?: number
          password_hash?: string | null
          poster_url?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string | null
          status?: string
          stream_url?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          content_kind: string
          created_at: string
          episode_id: string | null
          id: string
          movie_id: string | null
          user_id: string
        }
        Insert: {
          content_kind?: string
          created_at?: string
          episode_id?: string | null
          id?: string
          movie_id?: string | null
          user_id: string
        }
        Update: {
          content_kind?: string
          created_at?: string
          episode_id?: string | null
          id?: string
          movie_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_count_banned: { Args: never; Returns: number }
      admin_get_ban_status: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          is_banned: boolean
          permanent_banned: boolean
          suspended_until: string
        }[]
      }
      dispatch_room_reminders: { Args: never; Returns: undefined }
      fanout_host_notification: {
        Args: {
          _host: string
          _href: string
          _kind: string
          _meta: Json
          _title: string
        }
        Returns: undefined
      }
      get_my_ban_status: {
        Args: never
        Returns: {
          is_banned: boolean
          permanent_banned: boolean
          suspended_until: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_device_banned: { Args: { _fp: string }; Returns: boolean }
      verify_watch_room_password: {
        Args: { _password_hash: string; _room_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "pending_streamer" | "approved_streamer"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "pending_streamer", "approved_streamer"],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
    },
  },
} as const
