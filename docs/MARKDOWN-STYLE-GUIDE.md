# Markdown Style Guide

This document defines the markdown formatting standards for the Redis ACL
Builder project.

---

## Automated Linting

All markdown files are automatically linted using
[markdownlint](https://github.com/DavidAnson/markdownlint) with our custom
configuration (`.markdownlintrc`).

### Pre-Commit Hook

A pre-commit hook automatically runs `markdownlint --fix` on all staged `.md`
files before allowing commits. This ensures all markdown files are properly
formatted before they enter the repository.

### Manual Linting

```bash
# Lint all markdown files
npx markdownlint-cli '**/*.md' --ignore node_modules --ignore venv \
  --ignore dist --ignore build

# Auto-fix issues
npx markdownlint-cli '**/*.md' --ignore node_modules --ignore venv \
  --ignore dist --ignore build --fix

# Lint specific file
npx markdownlint-cli README.md

# Auto-fix specific file
npx markdownlint-cli --fix README.md
```

---

## Markdown Rules Configuration

Our `.markdownlintrc` configuration is optimized for documentation:

```json
{
  "default": true,
  "MD013": false,           // No line length limit (documentation needs flexibility)
  "MD003": false,           // Allow any heading style (ATX or setext)
  "MD024": {
    "siblings_only": true   // Duplicate headings OK if not adjacent
  },
  "MD025": false,           // Multiple H1 headings allowed (multi-section docs)
  "MD029": false,           // Allow any ordered list style
  "MD033": false,           // HTML is allowed (for complex layouts)
  "MD040": false,           // Code blocks don't require language tags
  "MD041": false,           // First line doesn't need to be H1
  "MD045": false,           // Images don't require alt text
  "MD046": false,           // Allow any code block style (fenced or indented)
  "MD056": false            // Tables don't need strict column counts
}
```

---

## Style Guidelines

While we've disabled many strict rules, following these guidelines will improve consistency:

### Headings

- Use ATX-style headings (`#`, `##`, `###`)
- Add blank line before and after headings
- Use sentence case for headings

```markdown
## This is a Heading

Content here.
```

### Code Blocks

- Use fenced code blocks (```) with language identifiers when possible
- Add blank line before and after code blocks

````markdown
```bash
npm install
```
````

### Lists

- Add blank line before and after lists
- Use `-` for unordered lists
- Use `1.` for ordered lists (auto-numbering)

```markdown
Unordered list:

- Item one
- Item two
- Item three

Ordered list:

1. First item
2. Second item
3. Third item
```

### Links

- Use descriptive link text (not "click here")
- Use reference-style links for repeated URLs

```markdown
# Inline links
See the [User Guide](docs/user-guide.md) for details.

# Reference-style links
See the [User Guide][guide] for details.

[guide]: docs/user-guide.md
```

### Emphasis

- Use `**bold**` for strong emphasis
- Use `*italic*` for emphasis
- Use `code` for inline code/commands

```markdown
**Important:** This is bold text.

*Note:* This is italic text.

Run `npm install` to install dependencies.
```

### Tables

- Use pipe tables with header row
- Align columns for readability
- Add blank line before and after tables

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
| Value 4  | Value 5  | Value 6  |
```

### Horizontal Rules

- Use `---` for horizontal rules
- Add blank line before and after

```markdown
## Section 1

Content here.

---

## Section 2

More content.
```

---

## Common Issues

### Long Lines

While we don't enforce line length, keep prose lines under 150 characters
when practical for easier diffs.

**Auto-wrap in VS Code:** Enable "Editor: Word Wrap" setting.

### Trailing Whitespace

Remove trailing whitespace from lines.

**Auto-trim in VS Code:** Enable "Files: Trim Trailing Whitespace" setting.

### Multiple Blank Lines

Avoid multiple consecutive blank lines (use single blank line).

### Hard Tabs

Use spaces, not tabs for indentation.

---

## VS Code Integration

### Recommended Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.wordWrap": "on",
  "files.trimTrailingWhitespace": true,
  "editor.insertSpaces": true,
  "editor.tabSize": 2,
  "[markdown]": {
    "editor.defaultFormatter": "DavidAnson.vscode-markdownlint",
    "editor.formatOnSave": true
  }
}
```

### Recommended Extensions

- [markdownlint][mdl-link] - Markdown linting and style checking
- [Markdown All in One][mdaio-link] - Keyboard shortcuts, table of contents,
  auto preview

[mdl-link]: https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint
[mdaio-link]: https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one

---

## Checking Compliance

### Before Committing

The pre-commit hook will automatically lint and fix your markdown files. If it fails:

1. Review the error messages
2. Fix manually or run `npx markdownlint-cli --fix <file>`
3. Stage the fixed file and commit again

### CI/CD Integration

Consider adding markdown linting to GitHub Actions:

```yaml
- name: Lint markdown files
  run: |
    npm install -g markdownlint-cli
    markdownlint '**/*.md' --ignore node_modules
```

---

## Exception Handling

If you need to disable a rule for a specific line:

```markdown
<!-- markdownlint-disable MD033 -->
<div class="custom-html">Custom HTML here</div>
<!-- markdownlint-enable MD033 -->
```

Or for an entire file:

```markdown
<!-- markdownlint-disable -->
Entire file without linting
<!-- markdownlint-enable -->
```

---

## Resources

- [markdownlint Rules][mdl-rules] - Complete rule reference
- [Markdown Guide](https://www.markdownguide.org/) - Markdown syntax guide
- [CommonMark Spec](https://spec.commonmark.org/) - Markdown specification

[mdl-rules]: https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md

---

## Summary

**Key Points:**

- ✅ Pre-commit hook automatically lints markdown files
- ✅ Flexible rules optimized for documentation
- ✅ Manual linting available via `npx markdownlint-cli`
- ✅ VS Code integration recommended
- ✅ Follow style guidelines for consistency

**When in doubt:** Run `npx markdownlint-cli --fix <file>` and let the linter
handle it!
