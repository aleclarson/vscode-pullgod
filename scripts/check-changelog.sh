#!/bin/bash
set -e

# Fetch the PR base branch to compare changes
git fetch origin "${GITHUB_BASE_REF}"

# Check if CHANGELOG.md is modified
CHANGELOG_MODIFIED=$(git diff --name-only "origin/${GITHUB_BASE_REF}" HEAD | grep "^CHANGELOG.md$" || true)

if [ -n "$CHANGELOG_MODIFIED" ]; then
  echo "CHANGELOG.md is modified."
  exit 0
fi

# Get list of changed files in src/
CHANGED_SRC_FILES=$(git diff --name-only "origin/${GITHUB_BASE_REF}" HEAD -- src/)

# Filter out test files from the changed source files
NON_TEST_CHANGES=$(echo "$CHANGED_SRC_FILES" | grep -v "\.test\.ts$" || true)

if [ -n "$NON_TEST_CHANGES" ]; then
  echo "Error: CHANGELOG.md must be modified in this Pull Request."
  echo "Modified source files:"
  echo "$NON_TEST_CHANGES"
  exit 1
else
  echo "Only test files or non-source files modified. Skipping changelog check."
  exit 0
fi
