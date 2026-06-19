import {
  to = vercel_project.amazuga
  id = var.vercel_project_id
}

# Supabase settings (import ID = project ref)
import {
  to = supabase_settings.production
  id = "woikgjvycparhtdugbom"
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

# amazuga.rw / amazuga.co.rw — redirect Worker and domain bindings
import {
  to = cloudflare_workers_script.amazuga_rw_redirect
  id = "017dd2074b8c0ae600658cab3f1c02eb/amazuga-rw-redirect"
}

import {
  to = cloudflare_workers_custom_domain.amazuga_rw_apex
  id = "017dd2074b8c0ae600658cab3f1c02eb/1c6d1a928649f43f0fb4a5905c9bcbdae5e9965b"
}

import {
  to = cloudflare_workers_custom_domain.amazuga_rw_www
  id = "017dd2074b8c0ae600658cab3f1c02eb/b4a267fe52e71f56b11495f3ef4c3c7f91ce8b4c"
}

import {
  to = cloudflare_workers_custom_domain.amazuga_co_rw_apex
  id = "017dd2074b8c0ae600658cab3f1c02eb/f506eb3db2af8fad87898062981eb5b38232fcfc"
}

import {
  to = cloudflare_workers_custom_domain.amazuga_co_rw_www
  id = "017dd2074b8c0ae600658cab3f1c02eb/deae129a44b369696b059b6411a26e2ffcacbad9"
}
