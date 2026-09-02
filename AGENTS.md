# Workspace Rules

## Pre-Deployment Requirements
- **Mandatory Ponytail Audit**: Before staging, committing, pushing, or deploying code to GitHub or version control, you MUST run a Ponytail Audit (`/ponytail-audit`) across the codebase.
- **Strict YAGNI**: Remove any dead code, speculative features, or over-engineered abstractions before deployment.
- **Verification**: Ensure all test suites pass and overall codebase test coverage remains >= 95%.
