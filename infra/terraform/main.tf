terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.19"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.13"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.6"
    }
    logtail = {
      source  = "BetterStackHQ/logtail"
      version = "~> 10.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.9"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "vercel" {
  api_token = var.vercel_token
  team      = var.vercel_team_id
}

provider "logtail" {
  api_token = var.logtail_api_token
}

provider "supabase" {
  access_token = var.supabase_access_token
}

moved {
  from = cloudflare_r2_bucket.agent_id_photos
  to   = cloudflare_r2_bucket.agent_id_photos_production
}

moved {
  from = random_password.agent_id_photo_admin_read_secret
  to   = random_password.agent_id_photo_admin_read_secret_production
}

moved {
  from = vercel_project_environment_variable.agent_id_photo_admin_read_secret
  to   = vercel_project_environment_variable.agent_id_photo_admin_read_secret_production
}

locals {
  better_stack_sources = {
    preview = {
      name = "amazuga-preview"
    }
    production = {
      name = "amazuga-prod"
    }
  }

  parcel_tiles_worker_file  = "${path.module}/../workers/parcel-tiles/index.js"
  listing_media_worker_file = "${path.module}/../workers/listing-media/index.js"
  cloudflare_tiles_worker_allowed_origins = distinct(
    concat(
      var.cloudflare_tiles_worker_local_allowed_origins,
      var.cloudflare_tiles_worker_public_allowed_origins,
      var.cloudflare_tiles_worker_preview_allowed_origins,
    )
  )
  cloudflare_listing_media_worker_allowed_origins = distinct(
    concat(
      var.cloudflare_listing_media_local_allowed_origins,
      var.cloudflare_listing_media_public_allowed_origins,
      var.cloudflare_listing_media_preview_allowed_origins,
    )
  )
  vercel_public_pmtiles_url = coalesce(
    var.vercel_public_pmtiles_url,
    format(
      "https://%s%s",
      cloudflare_workers_custom_domain.parcel_tiles.hostname,
      var.cloudflare_tiles_worker_public_path
    )
  )
  vercel_off_market_pmtiles_url = format(
    "https://%s%s",
    cloudflare_workers_custom_domain.off_market_tiles.hostname,
    var.cloudflare_off_market_tiles_worker_public_path
  )
  listing_media_public_base_url = format(
    "https://%s",
    cloudflare_r2_custom_domain.listing_media.domain
  )
  listing_media_upload_url = format(
    "https://%s",
    cloudflare_workers_custom_domain.listing_media.hostname
  )
  listing_media_preview_public_base_url = format(
    "https://%s",
    cloudflare_r2_custom_domain.listing_media_preview.domain
  )
  listing_media_preview_upload_url = format(
    "https://%s",
    cloudflare_workers_custom_domain.listing_media_preview.hostname
  )
}

data "cloudflare_zone" "amazuga" {
  filter = {
    account = {
      id = var.cloudflare_account_id
    }
    name = var.cloudflare_zone_name
  }
}

resource "logtail_source" "amazuga" {
  for_each = local.better_stack_sources

  name        = each.value.name
  platform    = "javascript"
  data_region = var.better_stack_data_region
  team_name   = var.better_stack_team_name
}

resource "cloudflare_r2_bucket" "parcel_tiles" {
  account_id    = var.cloudflare_account_id
  name          = var.cloudflare_r2_bucket_name
  location      = var.cloudflare_r2_bucket_location
  storage_class = "Standard"
}

resource "cloudflare_r2_managed_domain" "parcel_tiles" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.parcel_tiles.name
  enabled     = var.cloudflare_r2_enable_managed_public_domain
}

resource "cloudflare_r2_custom_domain" "parcel_tiles" {
  count = var.cloudflare_r2_custom_domain != null && var.cloudflare_zone_id != null ? 1 : 0

  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.parcel_tiles.name
  domain      = var.cloudflare_r2_custom_domain
  enabled     = true
  min_tls     = "1.2"
  zone_id     = var.cloudflare_zone_id
}

resource "cloudflare_r2_bucket_cors" "parcel_tiles" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.parcel_tiles.name

  rules = [
    {
      id = "Allow Parcel Map Browser Reads"
      allowed = {
        methods = ["GET", "HEAD"]
        origins = var.cloudflare_r2_cors_allowed_origins
        headers = ["Range"]
      }
      expose_headers  = ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"]
      max_age_seconds = 3600
    }
  ]
}

resource "cloudflare_workers_script" "parcel_tiles" {
  account_id         = var.cloudflare_account_id
  script_name        = var.cloudflare_tiles_worker_name
  content_file       = local.parcel_tiles_worker_file
  content_sha256     = filesha256(local.parcel_tiles_worker_file)
  main_module        = "index.js"
  compatibility_date = "2026-05-09"

  bindings = [
    {
      name        = "TILE_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.parcel_tiles.name
    },
    {
      name = "OBJECT_KEY"
      type = "plain_text"
      text = var.cloudflare_tiles_worker_object_key
    },
    {
      name = "ALLOWED_ORIGINS"
      type = "plain_text"
      text = jsonencode(local.cloudflare_tiles_worker_allowed_origins)
    },
    {
      name = "PUBLIC_PATH"
      type = "plain_text"
      text = var.cloudflare_tiles_worker_public_path
    },
    {
      name = "MAX_RANGE_BYTES"
      type = "plain_text"
      text = tostring(var.cloudflare_tiles_worker_max_range_bytes)
    },
    {
      name         = "TILE_RATE_LIMITER"
      type         = "ratelimit"
      namespace_id = var.cloudflare_tiles_worker_rate_limit_namespace_id
      simple = {
        limit  = var.cloudflare_tiles_worker_rate_limit_requests
        period = var.cloudflare_tiles_worker_rate_limit_period_seconds
      }
    },
    {
      name = "RATE_LIMIT_PERIOD_SECONDS"
      type = "plain_text"
      text = tostring(var.cloudflare_tiles_worker_rate_limit_period_seconds)
    },
  ]

  observability = {
    enabled = true
    logs = {
      enabled            = true
      invocation_logs    = true
      head_sampling_rate = 1
    }
  }

  lifecycle {
    ignore_changes = [observability]
  }
}

resource "cloudflare_workers_script_subdomain" "parcel_tiles" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.parcel_tiles.script_name
  enabled     = true
}

resource "cloudflare_workers_custom_domain" "parcel_tiles" {
  account_id = var.cloudflare_account_id
  hostname   = var.cloudflare_tiles_worker_hostname
  service    = cloudflare_workers_script.parcel_tiles.script_name
  zone_id    = data.cloudflare_zone.amazuga.id
}

resource "cloudflare_r2_bucket" "off_market_tiles" {
  account_id    = var.cloudflare_account_id
  name          = var.cloudflare_off_market_tiles_r2_bucket_name
  location      = var.cloudflare_r2_bucket_location
  storage_class = "Standard"
}

resource "cloudflare_r2_bucket_cors" "off_market_tiles" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.off_market_tiles.name

  rules = [
    {
      id = "Allow Off-Market Map Browser Reads"
      allowed = {
        methods = ["GET", "HEAD"]
        origins = var.cloudflare_r2_cors_allowed_origins
        headers = ["Range"]
      }
      expose_headers  = ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"]
      max_age_seconds = 3600
    }
  ]
}

resource "cloudflare_workers_script" "off_market_tiles" {
  account_id         = var.cloudflare_account_id
  script_name        = var.cloudflare_off_market_tiles_worker_name
  content_file       = local.parcel_tiles_worker_file
  content_sha256     = filesha256(local.parcel_tiles_worker_file)
  main_module        = "index.js"
  compatibility_date = "2026-05-09"

  bindings = [
    {
      name        = "TILE_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.off_market_tiles.name
    },
    {
      name = "OBJECT_KEY"
      type = "plain_text"
      text = var.cloudflare_off_market_tiles_worker_object_key
    },
    {
      name = "ALLOWED_ORIGINS"
      type = "plain_text"
      text = jsonencode(local.cloudflare_tiles_worker_allowed_origins)
    },
    {
      name = "PUBLIC_PATH"
      type = "plain_text"
      text = var.cloudflare_off_market_tiles_worker_public_path
    },
    {
      name = "MAX_RANGE_BYTES"
      type = "plain_text"
      text = tostring(var.cloudflare_tiles_worker_max_range_bytes)
    },
    {
      name         = "TILE_RATE_LIMITER"
      type         = "ratelimit"
      namespace_id = var.cloudflare_off_market_tiles_worker_rate_limit_namespace_id
      simple = {
        limit  = var.cloudflare_tiles_worker_rate_limit_requests
        period = var.cloudflare_tiles_worker_rate_limit_period_seconds
      }
    },
    {
      name = "RATE_LIMIT_PERIOD_SECONDS"
      type = "plain_text"
      text = tostring(var.cloudflare_tiles_worker_rate_limit_period_seconds)
    },
  ]

  observability = {
    enabled = true
    logs = {
      enabled            = true
      invocation_logs    = true
      head_sampling_rate = 1
    }
  }

  lifecycle {
    ignore_changes = [observability]
  }
}

resource "cloudflare_workers_script_subdomain" "off_market_tiles" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.off_market_tiles.script_name
  enabled     = true
}

resource "cloudflare_workers_custom_domain" "off_market_tiles" {
  account_id = var.cloudflare_account_id
  hostname   = var.cloudflare_off_market_tiles_worker_hostname
  service    = cloudflare_workers_script.off_market_tiles.script_name
  zone_id    = data.cloudflare_zone.amazuga.id
}

resource "vercel_project_environment_variable" "off_market_pmtiles_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "NEXT_PUBLIC_OFF_MARKET_PMTILES_URL"
  value      = local.vercel_off_market_pmtiles_url
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "Public Worker-backed PMTiles URL for off-market parcel discoverability dots."
}

resource "cloudflare_r2_bucket" "agent_id_photos_production" {
  account_id    = var.cloudflare_account_id
  name          = var.cloudflare_agent_id_photos_production_bucket_name
  location      = var.cloudflare_agent_id_photos_production_bucket_location
  storage_class = "Standard"
  # No cloudflare_r2_custom_domain or cloudflare_r2_managed_domain attached —
  # this production bucket is private; access goes through the production
  # listing-media worker's /admin-read/ endpoint.
}

resource "cloudflare_r2_bucket" "agent_id_photos_preview" {
  account_id    = var.cloudflare_account_id
  name          = var.cloudflare_agent_id_photos_preview_bucket_name
  location      = var.cloudflare_agent_id_photos_preview_bucket_location
  storage_class = "Standard"
  # Preview private ID photos are isolated from production and are only readable
  # through the preview listing-media worker's /admin-read/ endpoint.
}

resource "random_password" "agent_id_photo_admin_read_secret_production" {
  length  = 48
  special = false
}

resource "random_password" "agent_id_photo_admin_read_secret_preview" {
  length  = 48
  special = false
}

resource "cloudflare_r2_bucket" "listing_media" {
  account_id    = var.cloudflare_account_id
  name          = var.cloudflare_listing_media_bucket_name
  location      = var.cloudflare_listing_media_bucket_location
  storage_class = "Standard"
}

resource "cloudflare_r2_custom_domain" "listing_media" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.listing_media.name
  domain      = var.cloudflare_listing_media_custom_domain
  enabled     = true
  min_tls     = "1.2"
  zone_id     = data.cloudflare_zone.amazuga.id
}

resource "random_password" "listing_media_upload_secret" {
  length  = 48
  special = false
}

resource "random_password" "vercel_cron_secret" {
  length  = 48
  special = false
}

resource "cloudflare_workers_script" "listing_media" {
  account_id         = var.cloudflare_account_id
  script_name        = var.cloudflare_listing_media_worker_name
  content_file       = local.listing_media_worker_file
  content_sha256     = filesha256(local.listing_media_worker_file)
  main_module        = "index.js"
  compatibility_date = "2026-05-24"

  bindings = [
    {
      name        = "LISTING_MEDIA_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.listing_media.name
    },
    {
      name        = "AGENT_ID_PHOTOS_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.agent_id_photos_production.name
    },
    {
      name = "ADMIN_READ_SECRET"
      type = "secret_text"
      text = random_password.agent_id_photo_admin_read_secret_production.result
    },
    {
      name = "ALLOWED_ORIGINS"
      type = "plain_text"
      text = jsonencode(local.cloudflare_listing_media_worker_allowed_origins)
    },
    {
      name = "PUBLIC_BASE_URL"
      type = "plain_text"
      text = local.listing_media_public_base_url
    },
    {
      name = "UPLOAD_SHARED_SECRET"
      type = "plain_text"
      text = random_password.listing_media_upload_secret.result
    },
    {
      name = "CLOUDFLARE_ZONE_ID"
      type = "plain_text"
      text = data.cloudflare_zone.amazuga.id
    },
    {
      name = "CLOUDFLARE_API_TOKEN"
      type = "secret_text"
      text = coalesce(var.cloudflare_cache_purge_token, var.cloudflare_api_token)
    },
  ]

  observability = {
    enabled = true
    logs = {
      enabled            = true
      invocation_logs    = true
      head_sampling_rate = 1
    }
  }

  lifecycle {
    ignore_changes = [observability]
  }
}

resource "cloudflare_workers_script_subdomain" "listing_media" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.listing_media.script_name
  enabled     = true
}

resource "cloudflare_workers_custom_domain" "listing_media" {
  account_id = var.cloudflare_account_id
  hostname   = var.cloudflare_listing_media_worker_hostname
  service    = cloudflare_workers_script.listing_media.script_name
  zone_id    = data.cloudflare_zone.amazuga.id
}

# --- Preview listing media (separate bucket + worker from prod) ---

resource "cloudflare_r2_bucket" "listing_media_preview" {
  account_id    = var.cloudflare_account_id
  name          = var.cloudflare_listing_media_preview_bucket_name
  location      = var.cloudflare_listing_media_preview_bucket_location
  storage_class = "Standard"
}

resource "cloudflare_r2_custom_domain" "listing_media_preview" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.listing_media_preview.name
  domain      = var.cloudflare_listing_media_preview_custom_domain
  enabled     = true
  min_tls     = "1.2"
  zone_id     = data.cloudflare_zone.amazuga.id
}

resource "random_password" "listing_media_upload_secret_preview" {
  length  = 48
  special = false
}

resource "cloudflare_workers_script" "listing_media_preview" {
  account_id         = var.cloudflare_account_id
  script_name        = var.cloudflare_listing_media_preview_worker_name
  content_file       = local.listing_media_worker_file
  content_sha256     = filesha256(local.listing_media_worker_file)
  main_module        = "index.js"
  compatibility_date = "2026-05-24"

  bindings = [
    {
      name        = "LISTING_MEDIA_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.listing_media_preview.name
    },
    {
      name        = "AGENT_ID_PHOTOS_BUCKET"
      type        = "r2_bucket"
      bucket_name = cloudflare_r2_bucket.agent_id_photos_preview.name
    },
    {
      name = "ADMIN_READ_SECRET"
      type = "secret_text"
      text = random_password.agent_id_photo_admin_read_secret_preview.result
    },
    {
      name = "ALLOWED_ORIGINS"
      type = "plain_text"
      text = jsonencode(local.cloudflare_listing_media_worker_allowed_origins)
    },
    {
      name = "PUBLIC_BASE_URL"
      type = "plain_text"
      text = local.listing_media_preview_public_base_url
    },
    {
      name = "UPLOAD_SHARED_SECRET"
      type = "plain_text"
      text = random_password.listing_media_upload_secret_preview.result
    },
    {
      name = "CLOUDFLARE_ZONE_ID"
      type = "plain_text"
      text = data.cloudflare_zone.amazuga.id
    },
    {
      name = "CLOUDFLARE_API_TOKEN"
      type = "secret_text"
      text = coalesce(var.cloudflare_cache_purge_token, var.cloudflare_api_token)
    },
  ]

  observability = {
    enabled = true
    logs = {
      enabled            = true
      invocation_logs    = true
      head_sampling_rate = 1
    }
  }

  lifecycle {
    ignore_changes = [observability]
  }
}

resource "cloudflare_workers_script_subdomain" "listing_media_preview" {
  account_id  = var.cloudflare_account_id
  script_name = cloudflare_workers_script.listing_media_preview.script_name
  enabled     = true
}

resource "cloudflare_workers_custom_domain" "listing_media_preview" {
  account_id = var.cloudflare_account_id
  hostname   = var.cloudflare_listing_media_preview_worker_hostname
  service    = cloudflare_workers_script.listing_media_preview.script_name
  zone_id    = data.cloudflare_zone.amazuga.id
}

resource "vercel_project" "amazuga" {
  name            = "amazuga"
  framework       = "nextjs"
  node_version    = "24.x"
  skew_protection = "12 hours"

  git_repository = {
    type              = "github"
    repo              = "danksky/amazuga"
    production_branch = "main"
  }

  resource_config = {
    fluid                    = true
    function_default_regions = ["iad1"]
  }

  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}

resource "vercel_project_environment_variable" "parcel_pmtiles_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "NEXT_PUBLIC_PARCEL_PMTILES_URL"
  value      = local.vercel_public_pmtiles_url
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "Public Worker-backed PMTiles URL for parcel maps."
}

resource "vercel_project_environment_variable" "better_stack_source_token" {
  for_each = {
    preview    = logtail_source.amazuga["preview"].token
    production = logtail_source.amazuga["production"].token
  }

  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "BETTER_STACK_SOURCE_TOKEN"
  value      = each.value
  sensitive  = true
  target     = [each.key]
  comment    = "Better Stack source token for ${each.key} runtime logs."
}

resource "vercel_project_environment_variable" "listing_image_upload_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGE_UPLOAD_URL"
  value      = local.listing_media_upload_url
  sensitive  = false
  target     = ["production"]
  comment    = "Production listing media upload worker URL."
}

resource "vercel_project_environment_variable" "listing_image_upload_url_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGE_UPLOAD_URL"
  value      = local.listing_media_preview_upload_url
  sensitive  = false
  target     = ["preview"]
  comment    = "Preview listing media upload worker URL (separate bucket from prod)."
}

resource "vercel_project_environment_variable" "listing_images_public_base_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGES_PUBLIC_BASE_URL"
  value      = local.listing_media_public_base_url
  sensitive  = false
  target     = ["production"]
  comment    = "Production public base URL for listing media stored in R2."
}

resource "vercel_project_environment_variable" "listing_images_public_base_url_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGES_PUBLIC_BASE_URL"
  value      = local.listing_media_preview_public_base_url
  sensitive  = false
  target     = ["preview"]
  comment    = "Preview public base URL for listing media stored in R2 (separate bucket from prod)."
}

resource "vercel_project_environment_variable" "listing_image_upload_secret" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGE_UPLOAD_SECRET"
  value      = random_password.listing_media_upload_secret.result
  sensitive  = true
  target     = ["production"]
  comment    = "Production shared secret used to sign listing image upload intents."
}

resource "vercel_project_environment_variable" "listing_image_upload_secret_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGE_UPLOAD_SECRET"
  value      = random_password.listing_media_upload_secret_preview.result
  sensitive  = true
  target     = ["preview"]
  comment    = "Preview shared secret used to sign listing image upload intents."
}

resource "vercel_project_environment_variable" "agent_id_photo_admin_read_secret_production" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "AGENT_ID_PHOTO_ADMIN_READ_SECRET"
  value      = random_password.agent_id_photo_admin_read_secret_production.result
  sensitive  = true
  target     = ["production"]
  comment    = "Production secret for server-side admin reads of private agent ID photos via the production listing-media worker."
}

resource "vercel_project_environment_variable" "agent_id_photo_admin_read_secret_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "AGENT_ID_PHOTO_ADMIN_READ_SECRET"
  value      = random_password.agent_id_photo_admin_read_secret_preview.result
  sensitive  = true
  target     = ["preview"]
  comment    = "Preview secret for server-side admin reads of private agent ID photos via the preview listing-media worker."
}

resource "vercel_project_environment_variable" "cron_secret" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "CRON_SECRET"
  value      = random_password.vercel_cron_secret.result
  sensitive  = true
  target     = ["production", "preview"]
  comment    = "Shared secret automatically sent by Vercel Cron to internal maintenance routes."
}

resource "vercel_project_environment_variable" "database_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "DATABASE_URL"
  value      = local.production_database_url
  sensitive  = true
  target     = ["production"]
  comment    = "Production Neon database URL (default/primary branch)."
}

resource "vercel_project_environment_variable" "database_url_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "DATABASE_URL_PREVIEW"
  value      = local.preview_database_url
  sensitive  = true
  target     = ["preview"]
  comment    = "Preview Neon database URL for preview deployments."
}

resource "neon_project" "amazuga" {
  name   = "amazuga"
  org_id = var.neon_org_id

  store_password = "yes"

  branch {
    name          = "production"
    role_name     = var.neon_production_role_name
    database_name = var.neon_production_database_name
  }

  default_endpoint_settings {
    suspend_timeout_seconds = 300
  }
}

resource "neon_branch" "preview" {
  project_id = neon_project.amazuga.id
  parent_id  = neon_project.amazuga.default_branch_id
  name       = "preview"
}

resource "neon_role" "preview" {
  project_id = neon_project.amazuga.id
  branch_id  = neon_branch.preview.id
  name       = var.neon_preview_role_name
}

resource "neon_database" "preview" {
  project_id = neon_project.amazuga.id
  branch_id  = neon_branch.preview.id
  name       = var.neon_preview_database_name
  owner_name = neon_role.preview.name
}

resource "neon_endpoint" "preview" {
  project_id = neon_project.amazuga.id
  branch_id  = neon_branch.preview.id
  type       = "read_write"

  suspend_timeout_seconds = 300
}

# --- Supabase ---

resource "supabase_settings" "production" {
  project_ref = var.supabase_project_ref

  auth = jsonencode({
    # Phone OTP via custom SMS hook — production project, no test OTP overrides
    external_phone_enabled = true
    hook_send_sms_enabled  = true
    hook_send_sms_uri      = var.supabase_hook_send_sms_url
    hook_send_sms_secrets  = "v1,${var.supabase_hook_secret}"
    sms_otp_exp            = 60
    sms_otp_length         = 6
  })

  lifecycle {
    ignore_changes = [api, database, network, storage]
  }
}

resource "supabase_settings" "preview" {
  project_ref = var.supabase_project_ref_preview

  auth = jsonencode(merge(
    {
      # Phone OTP via custom SMS hook — preview project, test OTP overrides allowed
      external_phone_enabled = true
      hook_send_sms_enabled  = true
      hook_send_sms_uri      = var.supabase_hook_send_sms_url_preview
      hook_send_sms_secrets  = "v1,${var.supabase_hook_secret_preview}"
      sms_otp_exp            = 60
      sms_otp_length         = 6
    },
    var.supabase_sms_test_otp != null ? {
      sms_test_otp             = var.supabase_sms_test_otp
      sms_test_otp_valid_until = var.supabase_sms_test_otp_valid_until
    } : {}
  ))

  lifecycle {
    ignore_changes = [api, database, network, storage]
  }
}

# --- Vercel env vars: auth ---

resource "vercel_project_environment_variable" "auth_mode" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "AUTH_MODE"
  value      = var.auth_mode
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "'otp' uses Supabase phone OTP; 'mock' uses cookie-only dev auth."
}

resource "vercel_project_environment_variable" "next_public_supabase_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "NEXT_PUBLIC_SUPABASE_URL"
  value      = var.next_public_supabase_url
  sensitive  = false
  target     = ["production"]
  comment    = "Production Supabase project URL."
}

resource "vercel_project_environment_variable" "next_public_supabase_url_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "NEXT_PUBLIC_SUPABASE_URL"
  value      = var.next_public_supabase_url_preview
  sensitive  = false
  target     = ["preview"]
  comment    = "Preview Supabase project URL."
}

resource "vercel_project_environment_variable" "next_public_supabase_anon_key" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  value      = var.next_public_supabase_anon_key
  sensitive  = true
  target     = ["production"]
  comment    = "Production Supabase anon/public JWT key."
}

resource "vercel_project_environment_variable" "next_public_supabase_anon_key_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  value      = var.next_public_supabase_anon_key_preview
  sensitive  = true
  target     = ["preview"]
  comment    = "Preview Supabase anon/public JWT key."
}

resource "vercel_project_environment_variable" "supabase_service_role_key" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  value      = var.supabase_service_role_key
  sensitive  = true
  target     = ["production"]
  comment    = "Production Supabase service role key (server-only)."
}

resource "vercel_project_environment_variable" "supabase_service_role_key_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  value      = var.supabase_service_role_key_preview
  sensitive  = true
  target     = ["preview"]
  comment    = "Preview Supabase service role key (server-only)."
}

resource "vercel_project_environment_variable" "supabase_hook_secret" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "SUPABASE_HOOK_SECRET"
  value      = var.supabase_hook_secret
  sensitive  = true
  target     = ["production"]
  comment    = "Production HMAC secret for verifying Supabase webhook signatures."
}

resource "vercel_project_environment_variable" "supabase_hook_secret_preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "SUPABASE_HOOK_SECRET"
  value      = var.supabase_hook_secret_preview
  sensitive  = true
  target     = ["preview"]
  comment    = "Preview HMAC secret for verifying Supabase webhook signatures."
}

# --- Vercel env vars: Africa's Talking ---

resource "vercel_project_environment_variable" "africas_talking_api_key" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "AFRICAS_TALKING_API_KEY"
  value      = var.africas_talking_api_key
  sensitive  = true
  target     = ["production", "preview"]
  comment    = "Africa's Talking API key for SMS delivery to +250 numbers."
}

resource "vercel_project_environment_variable" "africas_talking_username" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "AFRICAS_TALKING_USERNAME"
  value      = var.africas_talking_username
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "Africa's Talking account username ('sandbox' for testing, production username for live)."
}

resource "vercel_project_environment_variable" "africas_talking_sandbox" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "AFRICAS_TALKING_SANDBOX"
  value      = var.africas_talking_sandbox
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "'true' routes through AT sandbox (no real SMS); 'false' sends live SMS."
}

# --- Vercel env vars: Telnyx ---

resource "vercel_project_environment_variable" "telnyx_api_key" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "TELNYX_API_KEY"
  value      = var.telnyx_api_key
  sensitive  = true
  target     = ["production", "preview"]
  comment    = "Telnyx API key for +1 number OTP delivery."
}

resource "vercel_project_environment_variable" "telnyx_phone_number" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "TELNYX_PHONE_NUMBER"
  value      = var.telnyx_phone_number
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "Telnyx outbound number in E.164 format (+12762530653)."
}

# --- WAF rate limiting ---

resource "cloudflare_ruleset" "by_upi_rate_limit" {
  zone_id = data.cloudflare_zone.amazuga.id
  name    = "amazuga-by-upi-rate-limit"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [
    {
      action      = "block"
      expression  = "(http.request.uri.path eq \"/api/properties/by-upi\")"
      description = "Rate limit anonymous property UPI lookup endpoint"
      enabled     = true
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 10
        requests_per_period = var.by_upi_rate_limit_requests_per_period
        mitigation_timeout  = 10
      }
    }
  ]
}

# --- Production custom domains (amazuga.com + www) ---

resource "vercel_project_domain" "production_apex" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  domain     = "amazuga.com"
}

resource "vercel_project_domain" "production_www" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  domain     = "www.amazuga.com"
}

# Cloudflare supports CNAME flattening at the apex, so this works for the root domain.
resource "cloudflare_dns_record" "vercel_apex" {
  zone_id = data.cloudflare_zone.amazuga.id
  name    = "@"
  type    = "CNAME"
  content = "cname.vercel-dns.com"
  proxied = false
  ttl     = 1
  comment = "Vercel production — amazuga.com"
}

resource "cloudflare_dns_record" "vercel_www" {
  zone_id = data.cloudflare_zone.amazuga.id
  name    = "www"
  type    = "CNAME"
  content = "cname.vercel-dns.com"
  proxied = false
  ttl     = 1
  comment = "Vercel production — www.amazuga.com"
}

# --- Preview environment custom domain ---
#
# preview.amazuga.com tracks the `preview` git branch.
# Keep the preview branch up to date with whatever state you want
# preview.amazuga.com to serve.

resource "vercel_project_domain" "preview" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  domain     = "preview.amazuga.com"
  git_branch = "preview"
}

resource "cloudflare_dns_record" "vercel_preview_domain" {
  zone_id = data.cloudflare_zone.amazuga.id
  name    = "preview"
  type    = "CNAME"
  content = "cname.vercel-dns.com"
  proxied = false
  ttl     = 1
  comment = "Vercel preview environment — tracks the `preview` git branch"
}

# --- Email forwarding (Forward Email) ---

resource "cloudflare_dns_record" "mx_forwardemail_1" {
  zone_id  = data.cloudflare_zone.amazuga.id
  name     = "@"
  type     = "MX"
  content  = "mx1.forwardemail.net"
  priority = 10
  proxied  = false
  ttl      = 1
  comment  = "Forward Email MX record (primary)"
}

resource "cloudflare_dns_record" "mx_forwardemail_2" {
  zone_id  = data.cloudflare_zone.amazuga.id
  name     = "@"
  type     = "MX"
  content  = "mx2.forwardemail.net"
  priority = 10
  proxied  = false
  ttl      = 1
  comment  = "Forward Email MX record (secondary)"
}

resource "cloudflare_dns_record" "txt_forwardemail_verification" {
  zone_id = data.cloudflare_zone.amazuga.id
  name    = "@"
  type    = "TXT"
  content = "forward-email-site-verification=FubbXCfd81"
  proxied = false
  ttl     = 1
  comment = "Forward Email domain verification"
}
