-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.allowed_signup_domains (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  apex_domain character varying NOT NULL UNIQUE,
  CONSTRAINT allowed_signup_domains_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bug_reports (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  subject character varying,
  message text,
  profile_id uuid,
  CONSTRAINT bug_reports_pkey PRIMARY KEY (id),
  CONSTRAINT bug_reports_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.caption_examples (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  image_description text NOT NULL,
  caption text NOT NULL,
  explanation text NOT NULL,
  priority smallint NOT NULL DEFAULT '0'::smallint,
  image_id uuid,
  CONSTRAINT caption_examples_pkey PRIMARY KEY (id),
  CONSTRAINT caption_examples_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id)
);
CREATE TABLE public.caption_likes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  profile_id uuid NOT NULL,
  caption_id uuid NOT NULL,
  CONSTRAINT caption_likes_pkey PRIMARY KEY (id),
  CONSTRAINT caption_likes_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id),
  CONSTRAINT caption_likes_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.caption_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  profile_id uuid NOT NULL,
  image_id uuid NOT NULL,
  CONSTRAINT caption_requests_pkey PRIMARY KEY (id),
  CONSTRAINT caption_requests_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id),
  CONSTRAINT caption_requests_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.caption_saved (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  profile_id uuid NOT NULL,
  caption_id uuid NOT NULL,
  CONSTRAINT caption_saved_pkey PRIMARY KEY (id),
  CONSTRAINT caption_saved_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id),
  CONSTRAINT caption_saved_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.caption_votes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL,
  modified_datetime_utc timestamp with time zone,
  vote_value smallint NOT NULL,
  profile_id uuid NOT NULL,
  caption_id uuid NOT NULL,
  CONSTRAINT caption_votes_pkey PRIMARY KEY (id),
  CONSTRAINT caption_votes_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT caption_votes_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id)
);
CREATE TABLE public.captions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  content character varying,
  is_public boolean NOT NULL,
  profile_id uuid NOT NULL,
  image_id uuid NOT NULL,
  humor_flavor_id bigint,
  is_featured boolean NOT NULL DEFAULT false,
  caption_request_id bigint,
  like_count bigint NOT NULL DEFAULT '0'::bigint,
  llm_prompt_chain_id bigint,
  CONSTRAINT captions_pkey PRIMARY KEY (id),
  CONSTRAINT captions_caption_request_id_fkey FOREIGN KEY (caption_request_id) REFERENCES public.caption_requests(id),
  CONSTRAINT captions_humor_flavor_id_fkey FOREIGN KEY (humor_flavor_id) REFERENCES public.humor_flavors(id),
  CONSTRAINT captions_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id),
  CONSTRAINT captions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT captions_llm_prompt_chain_id_fkey FOREIGN KEY (llm_prompt_chain_id) REFERENCES public.llm_prompt_chains(id)
);
CREATE TABLE public.common_use_categories (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  name character varying,
  CONSTRAINT common_use_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.common_use_category_image_mappings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  image_id uuid,
  common_use_category_id bigint,
  CONSTRAINT common_use_category_image_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT common_use_category_image_mappings_common_use_category_id_fkey FOREIGN KEY (common_use_category_id) REFERENCES public.common_use_categories(id),
  CONSTRAINT common_use_category_image_mappings_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id)
);
CREATE TABLE public.communities (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  name character varying,
  CONSTRAINT communities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.community_context_tag_mappings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  community_context_id bigint NOT NULL,
  community_context_tag_id integer NOT NULL,
  CONSTRAINT community_context_tag_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT community_context_tag_mappings_community_context_id_fkey FOREIGN KEY (community_context_id) REFERENCES public.community_contexts(id),
  CONSTRAINT community_context_tag_mappings_community_context_tag_id_fkey FOREIGN KEY (community_context_tag_id) REFERENCES public.community_context_tags(id)
);
CREATE TABLE public.community_context_tags (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  name character varying NOT NULL,
  CONSTRAINT community_context_tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.community_contexts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  content text,
  community_id smallint,
  start_datetime_utc timestamp without time zone,
  end_datetime_utc timestamp without time zone,
  priority smallint,
  embedding USER-DEFINED,
  CONSTRAINT community_contexts_pkey PRIMARY KEY (id),
  CONSTRAINT community_contexts_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id)
);
CREATE TABLE public.dorms (
  id integer NOT NULL DEFAULT nextval('dorms_id_seq'::regclass),
  university_id integer NOT NULL,
  short_name character varying NOT NULL,
  full_name character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dorms_pkey PRIMARY KEY (id),
  CONSTRAINT dorms_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id)
);
CREATE TABLE public.humor_flavor_mix (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  humor_flavor_id bigint NOT NULL,
  caption_count smallint NOT NULL,
  CONSTRAINT humor_flavor_mix_pkey PRIMARY KEY (id),
  CONSTRAINT humor_flavor_mix_humor_flavor_id_fkey FOREIGN KEY (humor_flavor_id) REFERENCES public.humor_flavors(id)
);
CREATE TABLE public.humor_flavor_step_types (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  slug character varying NOT NULL,
  description text NOT NULL,
  CONSTRAINT humor_flavor_step_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.humor_flavor_steps (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  humor_flavor_id bigint NOT NULL,
  llm_temperature numeric,
  order_by smallint NOT NULL,
  llm_input_type_id smallint NOT NULL,
  llm_output_type_id smallint NOT NULL,
  llm_model_id smallint NOT NULL,
  humor_flavor_step_type_id smallint NOT NULL,
  llm_system_prompt text,
  llm_user_prompt text,
  description character varying,
  CONSTRAINT humor_flavor_steps_pkey PRIMARY KEY (id),
  CONSTRAINT humor_flavor_steps_llm_input_type_id_fkey FOREIGN KEY (llm_input_type_id) REFERENCES public.llm_input_types(id),
  CONSTRAINT humor_flavor_steps_llm_model_id_fkey FOREIGN KEY (llm_model_id) REFERENCES public.llm_models(id),
  CONSTRAINT humor_flavor_steps_llm_output_type_id_fkey FOREIGN KEY (llm_output_type_id) REFERENCES public.llm_output_types(id),
  CONSTRAINT humor_flavor_steps_humor_flavor_step_id_fkey FOREIGN KEY (humor_flavor_step_type_id) REFERENCES public.humor_flavor_step_types(id),
  CONSTRAINT humor_flavor_steps_humor_flavor_id_fkey FOREIGN KEY (humor_flavor_id) REFERENCES public.humor_flavors(id)
);
CREATE TABLE public.humor_flavor_theme_mappings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  humor_flavor_id bigint,
  humor_theme_id bigint,
  CONSTRAINT humor_flavor_theme_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT humor_flavor_theme_mappings_humor_flavor_id_fkey FOREIGN KEY (humor_flavor_id) REFERENCES public.humor_flavors(id),
  CONSTRAINT humor_flavor_theme_mappings_humor_theme_id_fkey FOREIGN KEY (humor_theme_id) REFERENCES public.humor_themes(id)
);
CREATE TABLE public.humor_flavors (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  slug character varying NOT NULL UNIQUE,
  CONSTRAINT humor_flavors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.humor_themes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  name character varying,
  description text,
  CONSTRAINT humor_themes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  url character varying,
  is_common_use boolean DEFAULT false,
  profile_id uuid DEFAULT auth.uid(),
  additional_context character varying,
  is_public boolean DEFAULT false,
  image_description text,
  celebrity_recognition text,
  embedding USER-DEFINED,
  CONSTRAINT images_pkey PRIMARY KEY (id),
  CONSTRAINT images_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.invitations (
  id integer NOT NULL DEFAULT nextval('invitations_id_seq'::regclass),
  invitee_email character varying NOT NULL,
  inviter_id uuid,
  invitation_token character varying NOT NULL UNIQUE,
  is_accepted boolean DEFAULT false,
  expires_datetime_utc timestamp without time zone DEFAULT (now() + '7 days'::interval),
  created_datetime_utc timestamp without time zone DEFAULT now(),
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.link_redirects (
  id integer NOT NULL DEFAULT nextval('link_redirects_id_seq'::regclass),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  destination_url text NOT NULL,
  visit_count integer NOT NULL DEFAULT 0,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  folder_path character varying,
  CONSTRAINT link_redirects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.llm_input_types (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  description character varying NOT NULL,
  slug character varying NOT NULL,
  CONSTRAINT llm_input_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.llm_model_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  llm_model_response text,
  processing_time_seconds smallint NOT NULL,
  llm_model_id smallint NOT NULL,
  profile_id uuid NOT NULL,
  caption_request_id bigint NOT NULL,
  llm_system_prompt text NOT NULL,
  llm_user_prompt text NOT NULL,
  llm_temperature numeric,
  humor_flavor_id bigint NOT NULL,
  llm_prompt_chain_id bigint,
  humor_flavor_step_id bigint,
  CONSTRAINT llm_model_responses_pkey PRIMARY KEY (id),
  CONSTRAINT llm_model_responses_caption_request_id_fkey FOREIGN KEY (caption_request_id) REFERENCES public.caption_requests(id),
  CONSTRAINT llm_model_responses_llm_model_id_fkey FOREIGN KEY (llm_model_id) REFERENCES public.llm_models(id),
  CONSTRAINT llm_model_responses_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT llm_model_responses_humor_flavor_id_fkey FOREIGN KEY (humor_flavor_id) REFERENCES public.humor_flavors(id),
  CONSTRAINT llm_model_responses_llm_prompt_chain_id_fkey FOREIGN KEY (llm_prompt_chain_id) REFERENCES public.llm_prompt_chains(id),
  CONSTRAINT llm_model_responses_humor_flavor_step_id_fkey FOREIGN KEY (humor_flavor_step_id) REFERENCES public.humor_flavor_steps(id)
);
CREATE TABLE public.llm_models (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  name character varying NOT NULL,
  llm_provider_id smallint NOT NULL,
  provider_model_id character varying NOT NULL,
  is_temperature_supported boolean NOT NULL DEFAULT false,
  CONSTRAINT llm_models_pkey PRIMARY KEY (id),
  CONSTRAINT llm_models_llm_provider_id_fkey FOREIGN KEY (llm_provider_id) REFERENCES public.llm_providers(id)
);
CREATE TABLE public.llm_output_types (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  description character varying NOT NULL,
  slug character varying NOT NULL,
  CONSTRAINT llm_output_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.llm_prompt_chains (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  caption_request_id bigint NOT NULL,
  CONSTRAINT llm_prompt_chains_pkey PRIMARY KEY (id),
  CONSTRAINT llm_prompt_chains_caption_request_id_fkey FOREIGN KEY (caption_request_id) REFERENCES public.caption_requests(id)
);
CREATE TABLE public.llm_providers (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  name character varying NOT NULL,
  CONSTRAINT llm_providers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.news_entities (
  id integer NOT NULL DEFAULT nextval('news_entities_id_seq'::regclass),
  news_id integer,
  entity text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['person'::text, 'org'::text, 'place'::text, 'event'::text, 'product'::text, 'acronym'::text])),
  CONSTRAINT news_entities_pkey PRIMARY KEY (id),
  CONSTRAINT news_entities_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_snippets(id)
);
CREATE TABLE public.news_snippets (
  id integer NOT NULL DEFAULT nextval('news_snippets_id_seq'::regclass),
  headline text NOT NULL,
  category text NOT NULL,
  source_url text,
  priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT news_snippets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.personalities (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  name character varying NOT NULL,
  CONSTRAINT personalities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profile_dorm_mappings (
  id integer NOT NULL DEFAULT nextval('profile_dorm_mappings_id_seq'::regclass),
  profile_id uuid NOT NULL,
  dorm_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_dorm_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT profile_dorm_mappings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_dorm_mappings_dorm_id_fkey FOREIGN KEY (dorm_id) REFERENCES public.dorms(id)
);
CREATE TABLE public.profile_university_major_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  university_major_id integer,
  CONSTRAINT profile_university_major_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT profile_university_major_mappings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_university_major_mappings_university_major_id_fkey FOREIGN KEY (university_major_id) REFERENCES public.university_major_mappings(id)
);
CREATE TABLE public.profile_university_mappings (
  id integer NOT NULL DEFAULT nextval('profile_university_mappings_id_seq'::regclass),
  profile_id uuid NOT NULL,
  university_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_university_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT profile_university_mappings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_university_mappings_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_datetime_utc timestamp with time zone DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  first_name character varying,
  last_name character varying,
  email text,
  is_superadmin boolean NOT NULL DEFAULT false,
  is_in_study boolean NOT NULL DEFAULT false,
  is_matrix_admin boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reported_captions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  caption_id uuid,
  profile_id uuid,
  reason text,
  CONSTRAINT reported_captions_pkey PRIMARY KEY (id),
  CONSTRAINT reported_captions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT reported_captions_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id)
);
CREATE TABLE public.reported_images (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  image_id uuid,
  profile_id uuid,
  reason text,
  CONSTRAINT reported_images_pkey PRIMARY KEY (id),
  CONSTRAINT reported_images_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT reported_images_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id)
);
CREATE TABLE public.screenshots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  caption_id uuid,
  profile_id uuid,
  CONSTRAINT screenshots_pkey PRIMARY KEY (id),
  CONSTRAINT screenshots_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id),
  CONSTRAINT screenshots_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.share_to_destinations (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  name character varying,
  CONSTRAINT share_to_destinations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.shares (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  profile_id uuid,
  share_to_destination_id smallint,
  proper_destination character varying,
  caption_id uuid,
  CONSTRAINT shares_pkey PRIMARY KEY (id),
  CONSTRAINT shares_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id),
  CONSTRAINT shares_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT shares_share_to_destination_id_fkey FOREIGN KEY (share_to_destination_id) REFERENCES public.share_to_destinations(id)
);
CREATE TABLE public.sidechat_posts (
  id uuid NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  content text,
  post_datetime_utc timestamp with time zone NOT NULL,
  like_count smallint NOT NULL DEFAULT '0'::smallint,
  CONSTRAINT sidechat_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.studies (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  slug character varying,
  description text,
  start_datetime_utc timestamp with time zone,
  end_datetime_utc timestamp with time zone,
  CONSTRAINT studies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.study_caption_mappings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  study_id bigint NOT NULL,
  caption_id uuid NOT NULL,
  CONSTRAINT study_caption_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT study_caption_mappings_caption_id_fkey FOREIGN KEY (caption_id) REFERENCES public.captions(id),
  CONSTRAINT study_caption_mappings_study_id_fkey FOREIGN KEY (study_id) REFERENCES public.studies(id)
);
CREATE TABLE public.study_image_set_image_mappings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  study_image_set_id bigint NOT NULL,
  image_id uuid NOT NULL,
  CONSTRAINT study_image_set_image_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT study_image_set_image_mappings_study_image_set_id_fkey FOREIGN KEY (study_image_set_id) REFERENCES public.study_image_sets(id),
  CONSTRAINT study_image_set_image_mappings_image_id_fkey FOREIGN KEY (image_id) REFERENCES public.images(id)
);
CREATE TABLE public.study_image_sets (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  slug character varying NOT NULL,
  description text,
  CONSTRAINT study_image_sets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.term_types (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  name character varying NOT NULL,
  CONSTRAINT term_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.terms (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp without time zone,
  term character varying NOT NULL,
  definition text NOT NULL,
  example text NOT NULL,
  priority smallint NOT NULL DEFAULT '0'::smallint,
  term_type_id smallint,
  CONSTRAINT terms_pkey PRIMARY KEY (id),
  CONSTRAINT terms_term_type_id_fkey FOREIGN KEY (term_type_id) REFERENCES public.term_types(id)
);
CREATE TABLE public.testflight_errors (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  error character varying,
  CONSTRAINT testflight_errors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transcript_personality_mappings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  personality_id smallint NOT NULL,
  transcript_id bigint NOT NULL,
  CONSTRAINT transcript_personality_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT transcript_personality_mappings_personality_id_fkey FOREIGN KEY (personality_id) REFERENCES public.personalities(id),
  CONSTRAINT transcript_personality_mappings_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.transcripts(id)
);
CREATE TABLE public.transcripts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_datetime_utc timestamp with time zone NOT NULL DEFAULT now(),
  modified_datetime_utc timestamp with time zone,
  content text NOT NULL,
  CONSTRAINT transcripts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.universities (
  id integer NOT NULL DEFAULT nextval('universities_id_seq'::regclass),
  name character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT universities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.university_major_mappings (
  university_id integer NOT NULL,
  id integer NOT NULL,
  major_id integer,
  CONSTRAINT university_major_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT university_major_mappings_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id),
  CONSTRAINT university_major_mappings_major_id_fkey FOREIGN KEY (major_id) REFERENCES public.university_majors(id)
);
CREATE TABLE public.university_majors (
  name text NOT NULL UNIQUE,
  id integer NOT NULL,
  CONSTRAINT university_majors_pkey PRIMARY KEY (id)
);