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

output "neon_project_id" {
  value = neon_project.amazuga.id
}

output "production_database_url" {
  value     = neon_project.amazuga.connection_uri
  sensitive = true
}

output "preview_database_url" {
  value     = local.preview_database_url
  sensitive = true
}
