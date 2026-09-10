SHELL := /bin/bash

# Usage: make cf-deploy CF_PROJECT=perler-beads
CF_PROJECT ?= perler-beads
CF_BRANCH ?= preview
OUT_DIR ?= out

.PHONY: help check cf-login cf-build cf-project-create cf-deploy cf-preview tunnel clean

help:
	@printf '%s\n' \
	  'make cf-build                         Build the static site into ./out' \
	  'make cf-login                         Authenticate Wrangler in the browser' \
	  'make cf-project-create CF_PROJECT=x   Create a Cloudflare Pages project' \
	  'make cf-deploy CF_PROJECT=x            Build and deploy to Cloudflare Pages' \
	  'make cf-preview CF_PROJECT=x           Deploy a preview branch to Pages' \
	  'make tunnel                           Expose local dev server with cloudflared' \
	  'make clean                            Remove the static build output'

check:
	@command -v npm >/dev/null || (printf '%s\n' 'npm is not installed or is not on PATH' >&2; exit 1)
	@printf 'wrangler: '; npx --yes wrangler --version | head -n 1
	@printf 'project: %s\n' '$(CF_PROJECT)'

cf-login: check
	npx --yes wrangler login

cf-build:
	npm run cf:build
	@test -f '$(OUT_DIR)/index.html' || (printf '%s\n' 'Static export was not generated: $(OUT_DIR)/index.html' >&2; exit 1)

cf-project-create: check
	npx --yes wrangler pages project create '$(CF_PROJECT)'

cf-deploy: check cf-build
	# Pages without --branch is the production deployment.
	npx --yes wrangler pages deploy '$(OUT_DIR)' --project-name '$(CF_PROJECT)'

cf-preview: check cf-build
	npx --yes wrangler pages deploy '$(OUT_DIR)' --project-name '$(CF_PROJECT)' --branch '$(CF_BRANCH)'

tunnel:
	@command -v cloudflared >/dev/null || (printf '%s\n' 'cloudflared is not installed or is not on PATH' >&2; exit 1)
	cloudflared tunnel --url http://localhost:3000

clean:
	rm -rf '$(OUT_DIR)'
