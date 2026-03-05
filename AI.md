# Fliplet Widget Development Context

## Project Overview
This is a Fliplet widget/component built using the Fliplet platform's component architecture.
Fliplet is a no-code app development platform with a custom widget system.

## Critical Documentation
- Main docs: https://developers.fliplet.com/
- JS APIs: https://developers.fliplet.com/API-Documentation.html
- Component structure: https://developers.fliplet.com/Building-components.html
- CLI docs: https://developers.fliplet.com/Quickstart.html

## Technology Stack
- Vue 3 (Composition API)
- Pinia for state management
- Vite for tooling
- Pure JavaScript (no TypeScript)
- Fliplet CLI 7.0.1

## Fliplet-Specific Patterns

### Component Structure
- `widget.html` - Main interface file
- `widget.js` - Widget logic and Fliplet API calls
- `widget.json` - Widget configuration
- Follow Fliplet's component structure guidelines exactly

### Fliplet API Usage
- Always use Fliplet.* namespace for API calls
- Data Sources: Use Fliplet.DataSources API
- Navigation: Use Fliplet.Navigate API
- Check documentation before implementing Fliplet-specific features

## Development Workflow

### Branch Strategy and PR Process
1. **Assign ticket**: Re-assign JIRA ticket to yourself and read the issue thoroughly
2. **Create project branch** from `master`:
   - Format: `project/{TICKET-NUMBER}-{DESCRIPTION}`
   - Example: `projects/farhad-platform-support/PS-78`
   - Command: `git checkout -b project/{TICKET-NUMBER}-{DESCRIPTION} master`
3. **Create feature/fix branch** from your project branch:
   - Format: `feature/{description}` or `fix/{description}`
   - Command: `git checkout -b feature/{description}`
4. **Push changes** to feature/fix branch and raise PR with base as the project branch
5. **Check automation testing**: Ensure no errors from automated tests
6. **Request review**: Post in #scrum-buddies Slack channel for code review
7. **Move to Q&A**: Once PR approved, move JIRA card to Q&A status
8. **QA handles merge**: QA team manages merge to staging (not developer responsibility)

### CLI Commands
- `fliplet run` - Test locally
- `fliplet publish` - Publish widget
- Test locally before publishing
- Never modify Fliplet core APIs

## Code Safety and Stability Requirements

### CRITICAL: Minimal Changes Philosophy
**DO NOT make radical or sweeping changes to the codebase**
- Make surgical, targeted fixes only
- Preserve existing patterns and architecture
- Don't refactor working code unless explicitly required by ticket
- Avoid "while we're here" improvements
- If code works but looks ugly, leave it alone unless ticket requires cleanup
- Changes should be minimal and directly address the ticket requirements

### Package Management
**ALWAYS ask user before updating packages**
- Some packages (especially ESLint) have breaking API changes
- Check package changelogs before suggesting updates
- Get explicit approval for any package updates
- Test thoroughly after any package changes
- Document why package update is necessary

### What Requires User Confirmation
❓ Any package updates (npm/yarn)
❓ Changes to build configuration (Vite, webpack)
❓ Modifications to ESLint rules or config
❓ Changes to existing working functionality
❓ Refactoring that isn't explicitly requested

### What Can Be Done Without Asking
✅ Bug fixes matching ticket description
✅ Adding new features per ticket requirements
✅ Writing tests for new/changed code
✅ Fixing actual errors or warnings
✅ Code formatting (if already established)

## Testing Requirements
**CRITICAL: All code changes must include functional tests**
- Focus on functional testing only (not visual/UI testing)
- Test Fliplet API interactions
- Test data flow and state management
- Test user interactions and event handlers
- Use Jest or similar for unit tests
- Test coverage should focus on logic, not rendering

### What to Test
✅ Data transformations
✅ API calls and responses
✅ Event handlers and callbacks
✅ State mutations (Pinia stores)
✅ Error handling
✅ Business logic

❌ Visual appearance
❌ CSS styling
❌ Layout positioning
❌ Responsive breakpoints

## Code Style
- Use ES6+ syntax
- Destructure imports: `import { ref, computed } from 'vue'`
- Prefer arrow functions for callbacks
- Keep components modular and reusable
- Follow existing code patterns in the file being modified

## Common Pitfalls
- Don't assume standard Node.js APIs are available in Fliplet runtime
- Always check Fliplet API documentation for correct usage
- Test on Fliplet platform, not just locally
- Don't break existing functionality with "improvements"
- Respect the existing codebase structure and patterns
