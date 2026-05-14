locals {
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

output "production_database_url" {
  value     = neon_project.amazuga.connection_uri
  sensitive = true
}

output "preview_database_url" {
  value     = local.preview_database_url
  sensitive = true
}
