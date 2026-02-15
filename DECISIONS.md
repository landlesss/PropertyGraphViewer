# Technical Decisions and Trade-offs

This document describes the technical decisions made during development and the trade-offs considered.

## Technology Choices

### Frontend: React + TypeScript + Vite

**Why React?**
- Most popular and well-supported framework
- Excellent ecosystem and community
- Component-based architecture fits well for this use case

**Why TypeScript?**
- Type safety throughout the application
- Better IDE support and autocomplete
- Catches errors at compile time
- Makes refactoring safer

**Why Vite?**
- Fast development server
- Excellent TypeScript support
- Modern build tooling
- Better performance than Create React App

### Backend: Fastify + better-sqlite3

**Why Fastify?**
- High performance for API endpoints
- Built-in TypeScript support
- Lightweight and fast (faster than Express)
- Excellent plugin ecosystem
- Built-in request validation support

**Why better-sqlite3?**
- Native SQLite bindings (faster than sqlite3)
- Synchronous API (simpler for read-only operations)
- No external dependencies
- Perfect for read-only database access

### Graph Visualization: Cytoscape.js

**Why Cytoscape?**
- Professional graph visualization library
- Excellent performance with large graphs (handles 1000+ nodes)
- Rich interaction features (zoom, pan, drag, click)
- Well-documented and maintained
- Supports custom layouts (cose, grid, etc.)

**Alternatives considered:**
- D3.js: More flexible but requires more code
- vis.js: Good but Cytoscape has better performance
- React Flow: Good for React but less mature

## Architecture Decisions

### State Management: useReducer

**Decision:** Used `useReducer` instead of multiple `useState` hooks.

**Why?**
- Centralized state logic makes debugging easier
- Better for complex state with multiple related values
- Easier to test and reason about
- Type-safe actions

**Trade-off:**
- Slightly more boilerplate than useState
- But worth it for maintainability

### Component Structure

**Decision:** Three main components: App, Graph, SourceViewer

**Why?**
- Single Responsibility Principle
- Easy to test and maintain
- Clear separation of concerns

**Could improve:**
- Could extract custom hooks (useFunctions, useGraph, useSource)
- But current structure is sufficient for this scope

### Error Handling

**Decision:** Error Boundary + try-catch in all async functions

**Why?**
- Prevents entire app from crashing
- User-friendly error messages
- Proper error logging

**Trade-off:**
- No error tracking service (Sentry, etc.)
- Acceptable for take-home, would add in production

## Security Decisions

### Input Validation

**Decision:** Comprehensive input validation on all endpoints

**Why?**
- Prevents SQL injection
- Prevents DoS attacks
- Validates data format

**Implementation:**
- Length limits (200 chars for queries, 500 for IDs)
- Character validation (regex patterns)
- Sanitization (escape special characters)
- Type checking

### SQL Injection Protection

**Decision:** Parameterized queries + input validation

**Why?**
- better-sqlite3 uses parameterized queries by default
- Additional validation as defense in depth
- Length limits prevent DoS

## Performance Decisions

### Graph Node Limiting

**Decision:** Limit graph to 60 nodes maximum

**Why?**
- Cytoscape performance degrades with 100+ nodes
- Better user experience with focused view
- Faster rendering and interaction

**Trade-off:**
- Users can't see full graph at once
- But can navigate by clicking nodes

### Debouncing

**Decision:** 300ms debounce on search input

**Why?**
- Reduces API calls
- Better user experience (no lag while typing)
- Prevents server overload

**Trade-off:**
- Slight delay before results appear
- But acceptable for better performance

### Request Cancellation

**Decision:** Use AbortController for all API requests

**Why?**
- Prevents race conditions
- Cancels outdated requests
- Better resource usage

### Memoization

**Decision:** React.memo, useMemo, useCallback throughout

**Why?**
- Prevents unnecessary re-renders
- Better performance
- Standard React best practice

## Feature Decisions

### Call Graph Explorer Only

**Decision:** Implemented only Call Graph Explorer (not Data Flow or Package Map)

**Why?**
- Most valuable for developers
- Focus on quality over quantity
- Demonstrates core competency

**Trade-off:**
- Less features than possible
- But better implementation quality

### External Functions Handling

**Decision:** Show external functions in graph but indicate they have no source code

**Why?**
- Complete graph view (shows all relationships)
- User understands what's external vs internal
- Better than hiding them

**Implementation:**
- Orange color for external nodes
- Warning message when clicking
- Clear explanation

## Code Quality Decisions

### TypeScript Types

**Decision:** Extracted types to `types/index.ts`

**Why?**
- Reusability
- Better organization
- Easier to maintain

### CSS Organization

**Decision:** Separate CSS files per component

**Why?**
- Better organization
- Easier to maintain
- No inline styles

**Trade-off:**
- More files
- But better structure

### Constants

**Decision:** Extracted magic numbers to `constants.ts`

**Why?**
- Single source of truth
- Easy to adjust
- Self-documenting

## Trade-offs Summary

1. **No Tests**
   - **Trade-off:** Focused on core functionality
   - **Reason:** Time constraint, tests would be added in production
   - **Impact:** Lower confidence in changes, but code is well-structured

2. **Single Feature (Call Graph Only)**
   - **Trade-off:** Less features than possible
   - **Reason:** Quality over quantity, most valuable feature
   - **Impact:** Demonstrates core skills, can be extended later

3. **Node Limiting (60 max)**
   - **Trade-off:** Can't see full graph at once
   - **Reason:** Performance and UX
   - **Impact:** Better performance, users can navigate

4. **Read-only Database**
   - **Trade-off:** No mutations
   - **Reason:** Assignment requirement, CPG is read-only by nature
   - **Impact:** Simpler backend, no concurrency issues

5. **No Error Tracking Service**
   - **Trade-off:** Errors only logged to console in dev
   - **Reason:** Take-home scope
   - **Impact:** Would add Sentry/etc in production

6. **No Virtualization for Lists**
   - **Trade-off:** Could be slow with 1000+ functions
   - **Reason:** 50 results limit makes it acceptable
   - **Impact:** Good enough for current use case

## What Would Be Different in Production

1. **Testing**: Unit, integration, and E2E tests
2. **Error Tracking**: Sentry or similar service
3. **Monitoring**: APM tools, metrics
4. **CI/CD**: Automated testing and deployment
5. **Documentation**: API docs (OpenAPI/Swagger)
6. **Rate Limiting**: More sophisticated than current
7. **Caching**: Response caching for frequently accessed data
8. **Code Splitting**: Lazy loading for better initial load
9. **Virtualization**: For long lists
10. **Dark Mode**: Theme support
