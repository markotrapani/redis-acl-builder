#!/bin/bash
# Redis ACL Builder - Version Bump Script
# Automates version updates across project files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default values
BUMP_TYPE=""
NEW_VERSION=""
DRY_RUN=false

# Help function
show_help() {
    cat << EOF
Redis ACL Builder Version Bump Script

Usage: $0 [OPTIONS] <version>

OPTIONS:
    -t, --type TYPE     Bump type: major, minor, patch, or custom
    -d, --dry-run       Show what would be changed without making changes
    -h, --help          Show this help message

EXAMPLES:
    $0 1.16.0-beta              # Set specific version
    $0 -t minor                 # Bump minor version (1.15.0 → 1.16.0)
    $0 -t patch                 # Bump patch version (1.15.0 → 1.15.1)
    $0 -d 1.16.0-beta           # Dry run to preview changes

FILES UPDATED:
    - CLAUDE.md (project documentation)
    - docker/README.md (Docker documentation)
    - Any other version references

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BUMP_TYPE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
        *)
            NEW_VERSION="$1"
            shift
            ;;
    esac
done

# Get current version from CLAUDE.md
get_current_version() {
    grep -o "Version.*: [0-9]*\.[0-9]*\.[0-9]*-beta" ../../CLAUDE.md | head -1 | sed 's/Version.*: //' || echo "1.15.0-beta"
}

# Bump version based on type
bump_version() {
    local current_version="$1"
    local bump_type="$2"

    # Remove -beta suffix for calculation
    local base_version=$(echo "$current_version" | sed 's/-beta//')
    local major minor patch

    IFS='.' read -r major minor patch <<< "$base_version"

    case $bump_type in
        major)
            echo "$((major + 1)).0.0-beta"
            ;;
        minor)
            echo "$major.$((minor + 1)).0-beta"
            ;;
        patch)
            echo "$major.$minor.$((patch + 1))-beta"
            ;;
        *)
            echo "Invalid bump type: $bump_type"
            exit 1
            ;;
    esac
}

# Validate version format
validate_version() {
    local version="$1"
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+-beta$ ]]; then
        echo -e "${RED}Error: Invalid version format. Expected: X.Y.Z-beta${NC}"
        exit 1
    fi
}

# Update version in files
update_files() {
    local old_version="$1"
    local new_version="$2"

    echo -e "${BLUE}Updating version from ${old_version} to ${new_version}${NC}"

    # Update CLAUDE.md
    local claude_file="../../CLAUDE.md"
    if [[ -f "$claude_file" ]]; then
        echo -e "  ${YELLOW}→${NC} Updating $claude_file"
        if [[ "$DRY_RUN" == "false" ]]; then
            sed -i.bak "s/Version.*: [0-9]*\.[0-9]*\.[0-9]*-beta/Version**: ${new_version}/" "$claude_file"
            rm -f "$claude_file.bak"
        else
            echo -e "    ${BLUE}[DRY RUN]${NC} Would update version to: ${new_version}"
        fi
    else
        echo -e "  ${RED}⚠${NC} File not found: $claude_file"
    fi

    # Update Docker README if it exists
    local readme_file="../docker/README.md"
    if [[ -f "$readme_file" ]]; then
        echo -e "  ${YELLOW}→${NC} Updating $readme_file"
        if [[ "$DRY_RUN" == "false" ]]; then
            sed -i.bak "s/redis-acl-builder:[v0-9.-]*beta/redis-acl-builder:v${new_version}/g" "$readme_file"
            rm -f "$readme_file.bak"
        else
            echo -e "    ${BLUE}[DRY RUN]${NC} Would update Docker tags to: v${new_version}"
        fi
    fi
}

# Create git tag
create_git_tag() {
    local version="$1"
    local tag_name="v${version}"

    echo -e "${BLUE}Creating git tag: ${tag_name}${NC}"

    if [[ "$DRY_RUN" == "false" ]]; then
        git tag -a "$tag_name" -m "Release version $version

- Complete responsive design overhaul
- Enhanced tablet and mobile experience
- Consolidated CSS architecture
- Automated CI/CD pipeline setup

🤖 Generated with version-bump script"
        echo -e "${GREEN}✓${NC} Git tag created: $tag_name"
        echo -e "${YELLOW}Push with: git push origin $tag_name${NC}"
    else
        echo -e "  ${BLUE}[DRY RUN]${NC} Would create tag: $tag_name"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}🚀 Redis ACL Builder Version Bump${NC}"
    echo ""

    # Get current version
    local current_version=$(get_current_version)
    echo -e "${BLUE}Current version: ${current_version}${NC}"

    # Determine new version
    if [[ -n "$BUMP_TYPE" && -z "$NEW_VERSION" ]]; then
        NEW_VERSION=$(bump_version "$current_version" "$BUMP_TYPE")
    elif [[ -z "$NEW_VERSION" ]]; then
        echo -e "${RED}Error: Please specify version or bump type${NC}"
        show_help
        exit 1
    fi

    # Validate new version
    validate_version "$NEW_VERSION"
    echo -e "${BLUE}New version: ${NEW_VERSION}${NC}"
    echo ""

    # Check if version already exists
    if git tag -l "v${NEW_VERSION}" | grep -q .; then
        echo -e "${RED}Error: Tag v${NEW_VERSION} already exists${NC}"
        exit 1
    fi

    # Update files
    update_files "$current_version" "$NEW_VERSION"
    echo ""

    # Create git tag
    create_git_tag "$NEW_VERSION"
    echo ""

    if [[ "$DRY_RUN" == "false" ]]; then
        echo -e "${GREEN}✅ Version bump completed successfully!${NC}"
        echo ""
        echo -e "${YELLOW}Next steps:${NC}"
        echo -e "  1. Review changes: git diff"
        echo -e "  2. Commit changes: git add -A && git commit -m 'bump: Update version to v${NEW_VERSION}'"
        echo -e "  3. Push changes: git push origin main"
        echo -e "  4. Push tag: git push origin v${NEW_VERSION}"
        echo -e "  5. CI/CD will automatically build and publish Docker images"
    else
        echo -e "${BLUE}🔍 Dry run completed - no changes made${NC}"
    fi
}

# Run main function
main