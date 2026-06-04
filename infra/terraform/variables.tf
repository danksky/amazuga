variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2 write permissions and zone access for custom domains."
  type        = string
  sensitive   = true
}

variable "cloudflare_cache_purge_token" {
  description = "Cloudflare API token scoped to Cache Purge only, injected into the listing-media worker to invalidate CDN on image deletion."
  type        = string
  sensitive   = true
  default     = null
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the R2 bucket."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID used for an optional R2 custom domain."
  type        = string
  default     = null
}

variable "cloudflare_zone_name" {
  description = "Cloudflare zone name used for Worker custom domains."
  type        = string
  default     = "amazuga.com"
}

variable "cloudflare_r2_bucket_name" {
  description = "Bucket name for public parcel PMTiles."
  type        = string
  default     = "amazuga-parcel-tiles"
}

variable "cloudflare_r2_bucket_location" {
  description = "Preferred location hint for the R2 bucket."
  type        = string
  default     = "enam"
}

variable "cloudflare_r2_custom_domain" {
  description = "Optional custom domain to attach to the R2 bucket, such as tiles.example.com."
  type        = string
  default     = null
}

variable "cloudflare_r2_enable_managed_public_domain" {
  description = "Whether to enable the Cloudflare-managed r2.dev public URL."
  type        = bool
  default     = true
}

variable "cloudflare_r2_cors_allowed_origins" {
  description = "Allowed origins for browser access to public parcel PMTiles."
  type        = list(string)
  default = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]
}

variable "cloudflare_tiles_worker_name" {
  description = "Worker name used to front parcel PMTiles."
  type        = string
  default     = "amazuga-parcel-tiles"
}

variable "cloudflare_tiles_worker_hostname" {
  description = "Custom hostname for the parcel tile Worker."
  type        = string
  default     = "tiles.amazuga.com"
}

variable "cloudflare_tiles_worker_public_path" {
  description = "Public request path served by the parcel tile Worker."
  type        = string
  default     = "/catalog/base"
}

variable "cloudflare_tiles_worker_object_key" {
  description = "R2 object key that stores the PMTiles archive."
  type        = string
  default     = "approved-provisional-parcels-v3.pmtiles"
}

variable "cloudflare_tiles_worker_local_allowed_origins" {
  description = "Local-development origins allowed to fetch PMTiles through the Worker."
  type        = list(string)
  default     = []
}

variable "cloudflare_tiles_worker_public_allowed_origins" {
  description = "Public production origins allowed to fetch PMTiles through the Worker."
  type        = list(string)
  default = [
    "https://amazuga.com",
    "https://www.amazuga.com",
  ]
}

variable "cloudflare_tiles_worker_preview_allowed_origins" {
  description = "Explicit preview origins allowed to fetch PMTiles through the Worker."
  type        = list(string)
  default = [
    "https://amazuga.vercel.app",
  ]
}

variable "cloudflare_tiles_worker_max_range_bytes" {
  description = "Maximum allowed byte range per PMTiles request."
  type        = number
  default     = 16777216
}

variable "cloudflare_tiles_worker_rate_limit_namespace_id" {
  description = "Unique Cloudflare rate limit namespace ID for the parcel tile Worker."
  type        = string
  default     = "41001"
}

variable "cloudflare_tiles_worker_rate_limit_requests" {
  description = "Number of allowed Worker tile requests per rate limit window."
  type        = number
  default     = 240
}

variable "cloudflare_tiles_worker_rate_limit_period_seconds" {
  description = "Rate limit window in seconds. Cloudflare currently supports 10 or 60."
  type        = number
  default     = 60
}

variable "cloudflare_off_market_tiles_r2_bucket_name" {
  description = "Bucket name for off-market parcel discoverability PMTiles."
  type        = string
  default     = "amazuga-off-market-tiles"
}

variable "cloudflare_off_market_tiles_worker_name" {
  description = "Worker name used to front off-market discoverability PMTiles."
  type        = string
  default     = "amazuga-off-market-tiles"
}

variable "cloudflare_off_market_tiles_worker_hostname" {
  description = "Custom hostname for the off-market tile Worker."
  type        = string
  default     = "discovery.amazuga.com"
}

variable "cloudflare_off_market_tiles_worker_public_path" {
  description = "Public request path served by the off-market tile Worker."
  type        = string
  default     = "/catalog/off-market"
}

variable "cloudflare_off_market_tiles_worker_object_key" {
  description = "R2 object key for the off-market PMTiles archive."
  type        = string
  default     = "off-market-v2.pmtiles"
}

variable "cloudflare_off_market_tiles_worker_rate_limit_namespace_id" {
  description = "Unique Cloudflare rate limit namespace ID for the off-market tile Worker."
  type        = string
  default     = "41002"
}

variable "by_upi_rate_limit_requests_per_period" {
  description = "Max requests per IP per 10-second window to /api/properties/by-upi before Cloudflare blocks."
  type        = number
  default     = 5
}

variable "cloudflare_agent_id_photos_production_bucket_name" {
  description = "Production bucket name for private agent ID photos. No public domain is attached; access is server-side only."
  type        = string
  default     = "amazuga-agent-id-photos"
}

variable "cloudflare_agent_id_photos_production_bucket_location" {
  description = "Preferred location hint for the production agent ID photos bucket."
  type        = string
  default     = "enam"
}

variable "cloudflare_agent_id_photos_preview_bucket_name" {
  description = "Preview bucket name for private agent ID photos. Separate from production to prevent cross-contamination."
  type        = string
  default     = "amazuga-agent-id-photos-preview"
}

variable "cloudflare_agent_id_photos_preview_bucket_location" {
  description = "Preferred location hint for the preview agent ID photos bucket."
  type        = string
  default     = "enam"
}

variable "cloudflare_listing_media_bucket_name" {
  description = "Bucket name for listing photos."
  type        = string
  default     = "amazuga-listing-images"
}

variable "cloudflare_listing_media_bucket_location" {
  description = "Preferred location hint for the listing media bucket."
  type        = string
  default     = "enam"
}

variable "cloudflare_listing_media_custom_domain" {
  description = "Custom domain for public listing images."
  type        = string
  default     = "media.amazuga.com"
}

variable "cloudflare_listing_media_worker_name" {
  description = "Worker name used for listing media uploads."
  type        = string
  default     = "amazuga-listing-media"
}

variable "cloudflare_listing_media_worker_hostname" {
  description = "Custom hostname for the listing media upload worker."
  type        = string
  default     = "uploads.amazuga.com"
}

variable "cloudflare_listing_media_local_allowed_origins" {
  description = "Local origins allowed to post listing media uploads through the Worker."
  type        = list(string)
  default = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]
}

variable "cloudflare_listing_media_public_allowed_origins" {
  description = "Public production origins allowed to post listing media uploads through the Worker."
  type        = list(string)
  default = [
    "https://amazuga.com",
    "https://www.amazuga.com",
  ]
}

variable "cloudflare_listing_media_preview_allowed_origins" {
  description = "Preview origins or suffix patterns allowed to post listing media uploads through the Worker."
  type        = list(string)
  default = [
    ".vercel.app",
  ]
}

variable "cloudflare_listing_media_preview_bucket_name" {
  description = "Bucket name for preview listing photos. Separate from prod to prevent cross-contamination."
  type        = string
  default     = "amazuga-listing-images-preview"
}

variable "cloudflare_listing_media_preview_bucket_location" {
  description = "Preferred location hint for the preview listing media bucket."
  type        = string
  default     = "enam"
}

variable "cloudflare_listing_media_preview_custom_domain" {
  description = "Custom domain for public preview listing images."
  type        = string
  default     = "preview-media.amazuga.com"
}

variable "cloudflare_listing_media_preview_worker_name" {
  description = "Worker name for preview listing media uploads."
  type        = string
  default     = "amazuga-listing-media-preview"
}

variable "cloudflare_listing_media_preview_worker_hostname" {
  description = "Custom hostname for the preview listing media upload worker."
  type        = string
  default     = "preview-uploads.amazuga.com"
}

variable "vercel_token" {
  description = "Vercel API token."
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team ID or slug."
  type        = string
}

variable "vercel_project_id" {
  description = "Existing Vercel project ID to import."
  type        = string
}

variable "vercel_public_pmtiles_url" {
  description = "Public PMTiles URL exposed to Vercel deployments."
  type        = string
  default     = null
}

# --- Better Stack / Logtail ---

variable "logtail_api_token" {
  description = "Better Stack Telemetry API token used by Terraform to manage Logtail sources."
  type        = string
  sensitive   = true
}

variable "better_stack_team_name" {
  description = "Optional Better Stack team name. Useful when authenticating Terraform with a global token."
  type        = string
  default     = null
  nullable    = true
}

variable "better_stack_data_region" {
  description = "Better Stack data region for Amazuga log sources."
  type        = string
  default     = "germany"
}

variable "neon_api_key" {
  description = "Neon API key."
  type        = string
  sensitive   = true
}

variable "neon_org_id" {
  description = "Neon organization ID."
  type        = string
}

variable "neon_production_database_name" {
  description = "Database name for production."
  type        = string
  default     = "amazuga"
}

variable "neon_production_role_name" {
  description = "Role name for production."
  type        = string
  default     = "amazuga_prod_owner"
}

variable "neon_preview_database_name" {
  description = "Database name for preview."
  type        = string
  default     = "amazuga_preview"
}

variable "neon_preview_role_name" {
  description = "Role name for preview."
  type        = string
  default     = "amazuga_preview_owner"
}

# --- Supabase ---

variable "supabase_access_token" {
  description = "Supabase personal access token (sbp_...)."
  type        = string
  sensitive   = true
}

variable "supabase_project_ref" {
  description = "Production Supabase project reference ID."
  type        = string
  default     = "woikgjvycparhtdugbom"
}

variable "supabase_project_ref_preview" {
  description = "Preview Supabase project reference ID."
  type        = string
  default     = "xdjclalffugjziukuqqi"
}

variable "supabase_hook_send_sms_url" {
  description = "Public URL production Supabase will POST to when sending an OTP SMS."
  type        = string
  default     = "https://amazuga.com/api/auth/send-sms"
}

variable "supabase_hook_send_sms_url_preview" {
  description = "Public URL preview Supabase will POST to when sending an OTP SMS."
  type        = string
  default     = "https://preview.amazuga.com/api/auth/send-sms"
}

variable "supabase_sms_test_otp" {
  description = "Comma-separated list of <e164_without_plus>=<code> test phone overrides. Set to null to disable."
  type        = string
  sensitive   = true
  default     = null
}

variable "supabase_sms_test_otp_production" {
  description = "Production comma-separated list of <e164_without_plus>=<code> test phone overrides. Set to null to disable."
  type        = string
  sensitive   = true
  default     = null
}

variable "supabase_sms_test_otp_valid_until" {
  description = "ISO-8601 expiry for the sms_test_otp entries."
  type        = string
  default     = "2026-12-31T23:59:59Z"
}

# --- Auth env vars (Vercel) ---

variable "auth_mode" {
  description = "AUTH_MODE for the Next.js app: 'mock' (cookie-only dev) or 'otp' (Supabase phone OTP)."
  type        = string
  default     = "otp"
}

variable "next_public_supabase_url" {
  description = "Production Supabase project URL (public)."
  type        = string
}

variable "next_public_supabase_anon_key" {
  description = "Production Supabase anon/public JWT key."
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Production Supabase service role JWT key (server-side only)."
  type        = string
  sensitive   = true
}

variable "supabase_hook_secret" {
  description = "HMAC secret used to verify production Supabase webhook signatures on /api/auth/send-sms."
  type        = string
  sensitive   = true
}

variable "next_public_supabase_url_preview" {
  description = "Preview Supabase project URL (public)."
  type        = string
  default     = "https://xdjclalffugjziukuqqi.supabase.co"
}

variable "next_public_supabase_anon_key_preview" {
  description = "Preview Supabase anon/public JWT key."
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key_preview" {
  description = "Preview Supabase service role JWT key (server-side only)."
  type        = string
  sensitive   = true
}

variable "supabase_hook_secret_preview" {
  description = "HMAC secret used to verify preview Supabase webhook signatures."
  type        = string
  sensitive   = true
}

# --- Africa's Talking env vars (Vercel) ---

variable "africas_talking_production_api_key" {
  description = "Production Africa's Talking API key."
  type        = string
  sensitive   = true
}

variable "africas_talking_production_username" {
  description = "Production Africa's Talking account username."
  type        = string
}

variable "africas_talking_preview_api_key" {
  description = "Preview Africa's Talking API key."
  type        = string
  sensitive   = true
}

variable "africas_talking_preview_username" {
  description = "Preview Africa's Talking account username."
  type        = string
}

variable "africas_talking_sandbox" {
  description = "Route SMS through the AT sandbox API when 'true'."
  type        = string
  default     = "true"
}

# --- Telnyx env vars (Vercel) ---

variable "telnyx_api_key" {
  description = "Telnyx API key for +1 number OTP delivery."
  type        = string
  sensitive   = true
}

variable "telnyx_phone_number" {
  description = "Telnyx outbound phone number in E.164 format."
  type        = string
  default     = "+12762530653"
}

variable "telnyx_public_key" {
  description = "Optional Telnyx Ed25519 public key for webhook signature verification. If omitted, callback URLs fall back to the shared secret query parameter."
  type        = string
  default     = null
  nullable    = true
}
