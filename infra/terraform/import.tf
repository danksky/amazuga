import {
  to = vercel_project.amazuga
  id = var.vercel_project_id
}

# Supabase settings (import ID = project ref)
import {
  to = supabase_settings.production
  id = "xdjclalffugjziukuqqi"
}

# Vercel env vars — bring under Terraform management
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
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/kcOfKve5qvVHiYeN"
}

import {
  to = vercel_project_environment_variable.supabase_service_role_key
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/MOrBSmXtMC8Hssw9"
}

import {
  to = vercel_project_environment_variable.supabase_hook_secret
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/oyghaQVqfvxWMvml"
}

import {
  to = vercel_project_environment_variable.africas_talking_api_key
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/NxPtYw1suzxyK01V"
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
  to = vercel_project_environment_variable.telnyx_api_key
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/QCKFWB2hWqjVWW5a"
}

import {
  to = vercel_project_environment_variable.telnyx_phone_number
  id = "team_oTT19Jmu6sLX5Cx4EgLCajgK/prj_hmBtq0JhdnDAJfQzP1IJHpD3vO8K/b0GGRA1lOi2L3otp"
}
