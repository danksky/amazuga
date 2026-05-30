import {
  to = vercel_project.amazuga
  id = var.vercel_project_id
}

# Supabase settings (import ID = project ref)
import {
  to = supabase_settings.production
  id = "xdjclalffugjziukuqqi"
}

# Vercel env vars added manually via API — bring under Terraform management
import {
  to = vercel_project_environment_variable.auth_mode
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/puzNfJxsdlXqGw5I"
}

import {
  to = vercel_project_environment_variable.next_public_supabase_url
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/xFUrglRIC69YHWoT"
}

import {
  to = vercel_project_environment_variable.next_public_supabase_anon_key
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/oN9zXjnkvNFjyQYl"
}

import {
  to = vercel_project_environment_variable.supabase_service_role_key
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/eBuNiMIb5hepYLZe"
}

import {
  to = vercel_project_environment_variable.supabase_hook_secret
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/9lmOUks8o0u2knLN"
}

import {
  to = vercel_project_environment_variable.africas_talking_api_key
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/Lcle5HKUUFSBIxjq"
}

import {
  to = vercel_project_environment_variable.africas_talking_username
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/kErxsAqZozHkKV89"
}

import {
  to = vercel_project_environment_variable.africas_talking_sandbox
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/j7QrE9wI18oKoQ4v"
}

import {
  to = vercel_project_environment_variable.twilio_account_sid
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/YI4bI7UtLIOHivxS"
}

import {
  to = vercel_project_environment_variable.twilio_auth_token
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/D5e6sA1sWdvdBYmn"
}

import {
  to = vercel_project_environment_variable.twilio_phone_number
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/QtaethEExsihE8DN"
}
