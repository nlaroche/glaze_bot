#!/usr/bin/env bash
set -euo pipefail

# Syncs secrets from SOPS to a Supabase project.
# Reads the decrypted .env file, sets all non-VITE_ secrets,
# and removes any stale secrets no longer in SOPS.
#
# Usage:
#   ./scripts/sync-secrets.sh staging
#   ./scripts/sync-secrets.sh production
#
# Requires:
#   - supabase CLI
#   - .env.staging or .env.production (run secrets/scripts/sync-env.sh first)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

ENV_NAME="${1:-}"
if [[ -z "$ENV_NAME" || ( "$ENV_NAME" != "staging" && "$ENV_NAME" != "production" ) ]]; then
  echo "Usage: $0 <staging|production>"
  exit 1
fi

ENV_FILE="$REPO_DIR/.env.${ENV_NAME}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found."
  echo "Run secrets/scripts/sync-env.sh first to decrypt secrets."
  exit 1
fi

# Map environment to project ref
if [[ "$ENV_NAME" == "production" ]]; then
  PROJECT_REF="tspalglvgypdktuhgqtf"
else
  PROJECT_REF="zwpwjceczndedcoegerx"
fi

echo "Syncing secrets to $ENV_NAME (project: $PROJECT_REF)"

# Collect secrets from .env file, skipping VITE_ prefixed (client-side only)
declare -A sops_keys
set_args=()
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* || "$key" == VITE_* ]] && continue
  [[ -z "$value" ]] && continue
  sops_keys["$key"]=1
  set_args+=("${key}=${value}")
done < "$ENV_FILE"

# Set all secrets
if [[ ${#set_args[@]} -gt 0 ]]; then
  echo "Setting ${#set_args[@]} secrets..."
  supabase secrets set "${set_args[@]}" --project-ref "$PROJECT_REF"
else
  echo "No secrets to set."
fi

# Remove stale secrets (skip Supabase built-ins)
echo "Checking for stale secrets..."
existing=$(supabase secrets list --project-ref "$PROJECT_REF" 2>/dev/null | tail -n +3 | awk '{print $1}')
unset_args=()
for existing_key in $existing; do
  [[ -z "$existing_key" ]] && continue
  [[ "$existing_key" == SUPABASE_* ]] && continue
  if [[ -z "${sops_keys[$existing_key]+x}" ]]; then
    echo "  Removing stale secret: $existing_key"
    unset_args+=("$existing_key")
  fi
done

if [[ ${#unset_args[@]} -gt 0 ]]; then
  supabase secrets unset "${unset_args[@]}" --project-ref "$PROJECT_REF"
else
  echo "  No stale secrets to remove."
fi

echo "Done. Secrets synced to $ENV_NAME."
