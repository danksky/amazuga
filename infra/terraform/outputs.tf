locals {
  # Production DB URL — uses the Neon project's default branch (production),
  # which is the primary branch created with the project.
  production_database_url = neon_project.amazuga.connection_uri

  preview_database_url = format(
    "postgresql://%s:%s@%s/%s?sslmode=require",
    neon_role.preview.name,
    urlencode(neon_role.preview.password),
    neon_endpoint.preview.host,
    neon_database.preview.name
  )
}

output "vercel_project_id" {
  value = vercel_project.amazuga.id
}

output "vercel_public_pmtiles_url" {
  value = local.vercel_public_pmtiles_url
}

output "neon_project_id" {
  value = neon_project.amazuga.id
}

output "better_stack_sources" {
  description = "Managed Better Stack source metadata by environment."
  value = {
    for env, source in logtail_source.amazuga : env => {
      id             = source.id
      name           = source.name
      platform       = source.platform
      data_region    = source.data_region
      ingesting_host = source.ingesting_host
      table_name     = source.table_name
      team_id        = source.team_id
    }
  }
}

output "cloudflare_r2_bucket_name" {
  value = cloudflare_r2_bucket.parcel_tiles.name
}

output "cloudflare_r2_managed_public_domain" {
  value = try(cloudflare_r2_managed_domain.parcel_tiles.domain, null)
}

output "cloudflare_r2_custom_domain" {
  value = try(cloudflare_r2_custom_domain.parcel_tiles[0].domain, null)
}

output "cloudflare_tiles_worker_hostname" {
  value = cloudflare_workers_custom_domain.parcel_tiles.hostname
}

output "cloudflare_tiles_worker_public_url" {
  value = format("https://%s%s", cloudflare_workers_custom_domain.parcel_tiles.hostname, var.cloudflare_tiles_worker_public_path)
}

output "cloudflare_off_market_tiles_r2_bucket_name" {
  value = cloudflare_r2_bucket.off_market_tiles.name
}

output "cloudflare_off_market_tiles_worker_public_url" {
  value = local.vercel_off_market_pmtiles_url
}

output "cloudflare_agent_id_photos_production_bucket_name" {
  value = cloudflare_r2_bucket.agent_id_photos_production.name
}

output "cloudflare_agent_id_photos_preview_bucket_name" {
  value = cloudflare_r2_bucket.agent_id_photos_preview.name
}

output "cloudflare_listing_media_bucket_name" {
  value = cloudflare_r2_bucket.listing_media.name
}

output "cloudflare_listing_media_public_url" {
  value = local.listing_media_public_base_url
}

output "cloudflare_listing_media_upload_url" {
  value = local.listing_media_upload_url
}

output "cloudflare_listing_media_preview_bucket_name" {
  value = cloudflare_r2_bucket.listing_media_preview.name
}

output "cloudflare_listing_media_preview_public_url" {
  value = local.listing_media_preview_public_base_url
}

output "cloudflare_listing_media_preview_upload_url" {
  value = local.listing_media_preview_upload_url
}

output "production_database_url" {
  value     = neon_project.amazuga.connection_uri
  sensitive = true
}

output "preview_database_url" {
  value     = local.preview_database_url
  sensitive = true
}
