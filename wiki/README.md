# Redis ACL Builder Wiki Pages

This directory contains all wiki pages for the Redis ACL Builder project.

## 📚 Pages Created

- `Home.md` - Main wiki landing page with navigation
- `Installation.md` - Platform-specific installation instructions
- `Getting-Started.md` - Step-by-step tutorial for beginners
- `User-Guide.md` - Comprehensive feature documentation
- `API-Reference.md` - Complete REST API documentation
- `Development.md` - Developer guide and contributing
- `Troubleshooting.md` - Common issues and solutions
- `FAQ.md` - Frequently asked questions

## 🚀 Publishing to GitHub Wiki

GitHub wikis are stored in a separate git repository.
Follow these steps to publish:

### Method 1: Clone and Push (Recommended)

```bash
# Clone the wiki repository
git clone https://github.com/markotrapani/redis-acl-builder.wiki.git

# Copy wiki pages
cp wiki/*.md redis-acl-builder.wiki/

# Navigate to wiki repo
cd redis-acl-builder.wiki

# Add and commit
git add *.md
git commit -m "docs: Add comprehensive wiki documentation

Created 8 wiki pages:
- Home page with navigation
- Complete installation guide
- Getting started tutorial
- Comprehensive user guide
- API reference documentation
- Development guide
- Troubleshooting guide
- Frequently asked questions

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push origin master
```

### Method 2: Manual Upload via GitHub UI

1. Go to <https://github.com/markotrapani/redis-acl-builder/wiki>
2. Click "New Page" for each markdown file
3. Copy content from each `.md` file
4. Use filename without extension as page title
5. Save each page

**Note:** Use Method 1 for bulk upload - much faster!

## 📝 Updating Wiki Pages

After editing any wiki page:

```bash
cd redis-acl-builder.wiki
git add *.md
git commit -m "docs: Update wiki pages with [description]"
git push origin master
```

## 🔗 Wiki Links

GitHub wiki pages use these link formats:

- `[Link Text](./Page-Name)` - Link to another wiki page
- `[Link Text](./Page-Name#section)` - Link to section within page
- `[Link Text](https://...)` - External link

Page names use hyphens for spaces (e.g., `Getting-Started`, not
`Getting Started`).

## ✅ Validation

Before publishing, ensure:

- [ ] All internal links point to existing pages
- [ ] All external links are valid
- [ ] Page names match filenames (without .md extension)
- [ ] Markdown renders correctly in GitHub
- [ ] Code blocks have language specified
- [ ] Tables are properly formatted

## 📊 Wiki Statistics

- **Total Pages:** 8
- **Total Size:** ~60KB
- **Estimated Read Time:** ~45 minutes (all pages)
- **Last Updated:** 2025-10-23

## 🎯 Maintenance

Wiki pages should be kept in sync with:

- README.md updates
- CONTRIBUTING.md changes
- New feature releases
- API endpoint changes

Update wiki pages when:

- New Redis version support added
- New features implemented
- API changes
- Installation process changes
- Common issues discovered

## 📖 Content Sources

Wiki content was extracted from:

- `README.md` - Installation, features, quick start
- `CONTRIBUTING.md` - Development guide
- `CLAUDE.md` - Troubleshooting tips
- `docs/WIKI-PLAN.md` - Structure and planning
- `frontend/templates/info.html` - Feature descriptions

---

**Questions?** See the main [README.md](../README.md) or visit [GitHub
Discussions](https://github.com/markotrapani/redis-acl-builder/discussions).
