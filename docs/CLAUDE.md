# DubaiPro Token Optimization Rules

## General Response Rules
- Respond in Persian
- Keep responses short and direct
- Avoid unnecessary explanations
- Ask questions only for critical ambiguities
- Avoid confirmation phrases

## Context Management
- Use summarize/compact after large tasks
- Do not repeat long history unnecessarily
- Keep only task-related context
- Prefer fresh chats for new major tasks

## Tool Usage
- Use parallel tool calls whenever possible
- Read multiple files in parallel
- Run multiple searches/greps in parallel
- Use sequential calls only when dependencies exist

## File Reading
- Read only necessary files
- Use grep/search before full file reads
- Avoid rereading files already in context
- Read large files in chunks when possible

## Code Editing
- Make minimal edits only
- Avoid touching unrelated code
- Use multi_edit for multiple changes in one file
- Apply changes directly without long explanations

## Code Generation
- Avoid over-engineering
- Prefer simple and maintainable solutions
- Add new dependencies only when truly necessary
- Reuse existing project patterns

## Next.js Rules
- Prefer server components
- Avoid unnecessary client components
- Keep bundle size small
- Use dynamic imports only when needed

## Todo Management
- Update todo list when starting tasks
- Mark completed tasks immediately
- Use todo list for task planning

## Memory Usage
- Store only important reusable context
- Avoid duplicate memories
- Check existing memories before creating new ones

## Command Execution
- Use run_command for terminal operations
- Set cwd instead of using cd
- Do not auto-run dangerous commands
- Avoid unnecessary installs/builds

## Response Structure
- Start directly without introductions
- Use markdown headings
- Use code blocks for code
- Keep output concise and practical