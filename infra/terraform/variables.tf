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
