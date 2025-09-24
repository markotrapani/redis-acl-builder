#!/bin/bash

# Docker Hub Tag Maintenance Script
# Provides utilities for managing Docker Hub repository tags
# Requires DOCKERHUB_TOKEN environment variable

set -e

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-markotrapani608}"
REPO_NAME="${REPO_NAME:-redis-acl-builder}"
DOCKER_HUB_API="https://hub.docker.com/v2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check requirements
check_requirements() {
    if [[ -z "$DOCKERHUB_TOKEN" ]]; then
        log_error "DOCKERHUB_TOKEN environment variable is required"
        log_info "Set it with: export DOCKERHUB_TOKEN='your_token_here'"
        log_info "Or in GitHub Actions, it's available as: \${{ secrets.DOCKERHUB_TOKEN }}"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed"
        log_info "Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
        exit 1
    fi
}

# Get Docker Hub bearer token
get_bearer_token() {
    log_info "Authenticating with Docker Hub API..."

    local response
    response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"username\": \"${DOCKER_USERNAME}\", \"password\": \"${DOCKERHUB_TOKEN}\"}" \
        "${DOCKER_HUB_API}/users/login/")

    if [[ $? -ne 0 ]]; then
        log_error "Failed to authenticate with Docker Hub API"
        exit 1
    fi

    local token
    token=$(echo "$response" | jq -r '.token')

    if [[ "$token" == "null" || -z "$token" ]]; then
        log_error "Failed to get bearer token"
        log_error "Response: $response"
        exit 1
    fi

    echo "$token"
}

# List all tags
list_tags() {
    log_info "Fetching tags for ${DOCKER_USERNAME}/${REPO_NAME}..."

    curl -s "${DOCKER_HUB_API}/repositories/${DOCKER_USERNAME}/${REPO_NAME}/tags/?page_size=100" | \
        jq -r '.results[] | .name' | sort
}

# List tags matching a pattern
list_tags_pattern() {
    local pattern="$1"
    if [[ -z "$pattern" ]]; then
        log_error "Pattern is required"
        exit 1
    fi

    log_info "Fetching tags matching pattern: '$pattern'"

    curl -s "${DOCKER_HUB_API}/repositories/${DOCKER_USERNAME}/${REPO_NAME}/tags/?page_size=100" | \
        jq -r '.results[] | select(.name | test("'"$pattern"'")) | .name' | sort
}

# Delete tags matching a pattern
delete_tags_pattern() {
    local pattern="$1"
    local dry_run="${2:-false}"

    if [[ -z "$pattern" ]]; then
        log_error "Pattern is required"
        exit 1
    fi

    local bearer_token
    bearer_token=$(get_bearer_token)

    if [[ -z "$bearer_token" ]]; then
        log_error "Failed to get authentication token"
        exit 1
    fi

    log_info "Finding tags matching pattern: '$pattern'"

    local tags
    tags=$(curl -s "${DOCKER_HUB_API}/repositories/${DOCKER_USERNAME}/${REPO_NAME}/tags/?page_size=100" | \
        jq -r '.results[] | select(.name | test("'"$pattern"'")) | .name')

    if [[ -z "$tags" ]]; then
        log_warning "No tags found matching pattern: '$pattern'"
        return 0
    fi

    log_info "Found $(echo "$tags" | wc -l | xargs) tags to delete:"
    echo "$tags" | sed 's/^/  - /'

    if [[ "$dry_run" == "true" ]]; then
        log_warning "DRY RUN: No tags were actually deleted"
        return 0
    fi

    echo
    read -p "Are you sure you want to delete these tags? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deletion cancelled"
        return 0
    fi

    local deleted_count=0
    local failed_count=0

    while IFS= read -r tag; do
        log_info "Deleting tag: $tag"

        local response
        local http_code
        response=$(curl -s -w "%{http_code}" -X DELETE \
            -H "Authorization: Bearer $bearer_token" \
            "${DOCKER_HUB_API}/repositories/${DOCKER_USERNAME}/${REPO_NAME}/tags/${tag}/")

        http_code="${response: -3}"

        if [[ "$http_code" == "204" ]]; then
            log_success "Deleted $tag"
            ((deleted_count++))
        else
            log_error "Failed to delete $tag (HTTP $http_code)"
            if [[ ${#response} -gt 3 ]]; then
                log_error "Response: ${response%???}"
            fi
            ((failed_count++))
        fi
    done <<< "$tags"

    echo
    log_success "Deletion complete: $deleted_count deleted, $failed_count failed"
}

# Delete specific tags
delete_tags() {
    local tags=("$@")

    if [[ ${#tags[@]} -eq 0 ]]; then
        log_error "At least one tag is required"
        exit 1
    fi

    local bearer_token
    bearer_token=$(get_bearer_token)

    if [[ -z "$bearer_token" ]]; then
        log_error "Failed to get authentication token"
        exit 1
    fi

    log_info "Tags to delete:"
    printf '  - %s\n' "${tags[@]}"

    echo
    read -p "Are you sure you want to delete these tags? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deletion cancelled"
        return 0
    fi

    local deleted_count=0
    local failed_count=0

    for tag in "${tags[@]}"; do
        log_info "Deleting tag: $tag"

        local response
        local http_code
        response=$(curl -s -w "%{http_code}" -X DELETE \
            -H "Authorization: Bearer $bearer_token" \
            "${DOCKER_HUB_API}/repositories/${DOCKER_USERNAME}/${REPO_NAME}/tags/${tag}/")

        http_code="${response: -3}"

        if [[ "$http_code" == "204" ]]; then
            log_success "Deleted $tag"
            ((deleted_count++))
        else
            log_error "Failed to delete $tag (HTTP $http_code)"
            if [[ ${#response} -gt 3 ]]; then
                log_error "Response: ${response%???}"
            fi
            ((failed_count++))
        fi
    done

    echo
    log_success "Deletion complete: $deleted_count deleted, $failed_count failed"
}

# Show help
show_help() {
    cat << 'EOF'
Docker Hub Tag Maintenance Script

USAGE:
    ./scripts/docker-tag-maintenance.sh <command> [options]

COMMANDS:
    list                        List all tags
    list-pattern <pattern>      List tags matching regex pattern
    delete-pattern <pattern>    Delete tags matching regex pattern (interactive)
    delete-pattern-dry <pattern> Dry run: show what would be deleted
    delete <tag1> [tag2...]     Delete specific tags (interactive)
    help                        Show this help

EXAMPLES:
    # List all tags
    ./scripts/docker-tag-maintenance.sh list

    # List all beta tags
    ./scripts/docker-tag-maintenance.sh list-pattern ".*-beta$"

    # List all tags starting with 'v'
    ./scripts/docker-tag-maintenance.sh list-pattern "^v"

    # Dry run: show what v-prefixed tags would be deleted
    ./scripts/docker-tag-maintenance.sh delete-pattern-dry "^v"

    # Delete all tags starting with 'v' (interactive confirmation)
    ./scripts/docker-tag-maintenance.sh delete-pattern "^v"

    # Delete specific tags
    ./scripts/docker-tag-maintenance.sh delete v1.0.0 v1.1.0 old-tag

ENVIRONMENT VARIABLES:
    DOCKERHUB_TOKEN    Required. Docker Hub Personal Access Token
    DOCKER_USERNAME    Optional. Default: markotrapani608
    REPO_NAME          Optional. Default: redis-acl-builder

SETUP:
    export DOCKERHUB_TOKEN="dckr_pat_xxxxx"
    ./scripts/docker-tag-maintenance.sh list

GITHUB ACTIONS USAGE:
    - name: Clean up old tags
      env:
        DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
      run: |
        ./scripts/docker-tag-maintenance.sh delete-pattern "^v"

REQUIREMENTS:
    - curl
    - jq
    - DOCKERHUB_TOKEN environment variable
EOF
}

# Main script logic
main() {
    local command="$1"
    shift || true

    case "$command" in
        "list")
            check_requirements
            list_tags
            ;;
        "list-pattern")
            check_requirements
            list_tags_pattern "$1"
            ;;
        "delete-pattern")
            check_requirements
            delete_tags_pattern "$1" false
            ;;
        "delete-pattern-dry")
            check_requirements
            delete_tags_pattern "$1" true
            ;;
        "delete")
            check_requirements
            delete_tags "$@"
            ;;
        "help"|"--help"|"-h"|"")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"