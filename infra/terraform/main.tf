terraform {
  required_version = ">= 1.5.0"

  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.13"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 4.6"
    }
  }
}

provider "neon" {
  api_key = var.neon_api_key
}

provider "vercel" {
  api_token = var.vercel_token
  team      = var.vercel_team_id
}

resource "vercel_project" "amazuga" {
  name      = "amazuga"
  framework = "nextjs"
  node_version = "24.x"
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
