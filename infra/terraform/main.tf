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
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
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

locals {
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
}

data "cloudflare_zone" "amazuga" {
  filter = {
    account = {
      id = var.cloudflare_account_id
    }
    name = var.cloudflare_zone_name
  }
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

resource "vercel_project_environment_variable" "listing_image_upload_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGE_UPLOAD_URL"
  value      = local.listing_media_upload_url
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "Listing media upload worker URL."
}

resource "vercel_project_environment_variable" "listing_images_public_base_url" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGES_PUBLIC_BASE_URL"
  value      = local.listing_media_public_base_url
  sensitive  = false
  target     = ["production", "preview"]
  comment    = "Public base URL for listing media stored in R2."
}

resource "vercel_project_environment_variable" "listing_image_upload_secret" {
  project_id = vercel_project.amazuga.id
  team_id    = var.vercel_team_id
  key        = "LISTING_IMAGE_UPLOAD_SECRET"
  value      = random_password.listing_media_upload_secret.result
  sensitive  = true
  target     = ["production", "preview"]
  comment    = "Shared secret used to sign listing image upload intents."
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
  value      = local.preview_database_url
  sensitive  = true
  target     = ["production"]
  comment    = "Current runtime database URL. Production still points at the preview DB until the production schema is brought up to parity."
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
