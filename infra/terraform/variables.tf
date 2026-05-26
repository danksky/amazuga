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
  default     = "parcel-context-v1.pmtiles"
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
