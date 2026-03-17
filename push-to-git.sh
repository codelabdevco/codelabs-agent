#!/bin/bash
# ============================================================
# Push Agent Fleet Dashboard v2.0 to GitHub
# ============================================================
# วิธีใช้:
#   1. สร้าง Personal Access Token ที่ https://github.com/settings/tokens
#      - ติ๊ก "repo" scope
#   2. รันสคริปต์นี้:
#      ./push-to-git.sh YOUR_GITHUB_TOKEN
# ============================================================

TOKEN=$1

if [ -z "$TOKEN" ]; then
  echo "Usage: ./push-to-git.sh YOUR_GITHUB_TOKEN"
  echo ""
  echo "Get token at: https://github.com/settings/tokens"
  echo "Required scope: repo"
  exit 1
fi

REPO="codelabdevco/codelabs-agent"

echo "=== Pushing to github.com/$REPO ==="

# Set remote with token
git remote set-url origin "https://${TOKEN}@github.com/${REPO}.git" 2>/dev/null || \
git remote add origin "https://${TOKEN}@github.com/${REPO}.git"

# Force push (overwrites existing v1)
git push --force origin main

# Remove token from remote URL after push (security)
git remote set-url origin "https://github.com/${REPO}.git"

echo ""
echo "=== Done! ==="
echo "View: https://github.com/$REPO"
echo "82 files, 15 pages, 19 API routes pushed."
