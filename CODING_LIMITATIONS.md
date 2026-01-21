# Coding Limitations & Anti-Patterns

## Overview
This document captures coding anti-patterns and limitations identified during development, particularly around complex problem-solving scenarios.

## Key Anti-Patterns

### 1. Overcomplicating Solutions
**Problem:** Adding complexity instead of addressing root causes.

**Example:**
- Trying to convert all computed styles to inline styles
- Creating clones and manipulating DOM
- Using complex server-side Puppeteer for simple client-side captures

**Anti-Pattern:**
```typescript
// ❌ BAD: Overcomplicated
const clone = element.cloneNode(true);
// Apply all computed styles recursively
// Manipulate DOM
// Clone to hidden container
// Convert to HTML
// Send to server
// Use Puppeteer...

// ✅ GOOD: Simple and direct
const dataUrl = await toPng(element, { /* options */ });
```

**Guideline:** 
- Start with the simplest possible solution
- Identify the root cause before adding complexity
- If a solution requires 3+ layers of abstraction, reconsider the approach

### 2. Missing Root Cause Analysis
**Problem:** Treating symptoms instead of causes.

**Example:**
- Issue: Screenshots showing blank/incorrect content
- Symptom fix: Trying to manipulate styles, dimensions, overflow
- Root cause: CORS blocking external images

**Anti-Pattern:**
```typescript
// ❌ BAD: Fixing symptoms
- Manipulate overflow styles
- Clone elements
- Convert computed styles
- Force dimensions
// Still fails because images blocked by CORS

// ✅ GOOD: Fixing root cause
- Server-side proxy for images (fixes CORS)
- Convert images to base64
- Capture element directly
```

**Guideline:**
- Always ask: "What is the actual root cause?"
- Don't treat symptoms - fix the underlying issue
- If solution feels like a "hack" or "workaround", find the root cause

### 3. Premature Optimization & Over-Engineering
**Problem:** Adding complexity "just in case" or for theoretical edge cases.

**Example:**
- Using Puppeteer for pixel-perfect screenshots when html-to-image works
- Creating complex state management for simple UI updates
- Adding multiple fallback layers before testing the simplest approach

**Anti-Pattern:**
```typescript
// ❌ BAD: Over-engineered
- Server-side Puppeteer
- Complex HTML serialization
- Multiple fallback mechanisms
- State management for icons
- Custom rendering pipeline

// ✅ GOOD: Simple first
- Client-side html-to-image
- Direct element capture
- Let library handle edge cases
```

**Guideline:**
- Start with the simplest solution that could work
- Only add complexity when you have evidence it's needed
- Test simple solutions first before assuming they won't work

### 4. Not Stepping Back
**Problem:** Continuing down a path even when it's clearly not working.

**Example:**
- Multiple iterations of the same failed approach
- Adding more layers instead of reconsidering
- Not recognizing when to change strategy

**Anti-Pattern:**
```typescript
// ❌ BAD: Iterating on broken approach
Attempt 1: html2canvas with overflow fixes
Attempt 2: html2canvas with style manipulation  
Attempt 3: html-to-image with overflow fixes
Attempt 4: html-to-image with style conversion
Attempt 5: Puppeteer with style conversion
// All missing the real issue: CORS

// ✅ GOOD: Stepping back
Problem: Screenshots fail
Question: Why? Images not loading
Root cause: CORS
Solution: Server-side proxy → convert to base64 → capture
```

**Guideline:**
- After 2-3 failed attempts, step back and reconsider
- Ask: "Am I fixing the right problem?"
- Consider completely different approaches
- Look at the problem from a different angle

### 5. Not Understanding the Tool's Purpose
**Problem:** Using tools in ways they weren't designed for.

**Example:**
- Trying to make html-to-image handle CORS issues (not its job)
- Using Puppeteer for simple client-side captures
- Over-engineering when simpler solutions exist

**Anti-Pattern:**
```typescript
// ❌ BAD: Fighting the tool
// Trying to make html-to-image bypass CORS
// Adding complex workarounds
// Forcing it to do things it can't

// ✅ GOOD: Use the right tool
// Server-side proxy handles CORS (right tool)
// html-to-image handles rendering (right tool)
// Each tool does what it's good at
```

**Guideline:**
- Understand what each tool/library is designed for
- Don't fight the tool - use the right tool for the job
- If a tool makes something hard, there's probably a better tool

### 6. Ignoring Simple Solutions
**Problem:** Dismissing simple solutions because they seem "too easy" or assuming they won't work.

**Example:**
- Assuming client-side capture can't work without server-side help
- Not trying the simplest approach first
- Assuming problems are more complex than they are

**Anti-Pattern:**
```typescript
// ❌ BAD: Assuming simple won't work
// "html-to-image can't handle CORS"
// "Need server-side rendering"
// "Must manipulate styles"
// Skip trying simple solution

// ✅ GOOD: Try simple first
// Try direct capture
// If it fails, identify why (CORS)
// Fix the actual issue (proxy)
// Then try simple solution again
```

**Guideline:**
- Always try the simplest solution first
- Don't assume something won't work - test it
- Simple solutions are usually better than complex ones

## Positive Patterns

### 1. Root Cause First
```typescript
// Always identify root cause before fixing
Problem → Why? → Root Cause → Simple Fix
```

### 2. Simple Over Complex
```typescript
// Choose simple solutions
Direct capture > Complex manipulation
Native APIs > Custom solutions
Standard patterns > Clever hacks
```

### 3. Right Tool for Right Job
```typescript
// Each tool has its purpose
CORS issues → Server-side proxy
Rendering → Client-side library
Complex rendering → Server-side when needed
```

### 4. Iterative Problem Solving
```typescript
// Test → Identify issue → Fix → Test again
1. Try simplest solution
2. If fails, identify why
3. Fix root cause
4. Test simple solution again
```

## Checklist for Problem Solving

When facing a complex problem:

- [ ] What is the actual root cause? (Not symptoms)
- [ ] What is the simplest solution that could work?
- [ ] Have I tried the simple solution first?
- [ ] Am I using the right tool for this problem?
- [ ] Would a different approach work better?
- [ ] Am I overcomplicating this?
- [ ] If solution requires 3+ layers, reconsider

## Lessons Learned

1. **CORS issues → Server-side proxy** (not client-side workarounds)
2. **Image capture → Convert to base64 first** (not during capture)
3. **Element capture → Direct capture** (not clones/manipulation)
4. **Simple solutions usually work** (if root cause is fixed)
5. **Step back after 2-3 failures** (reconsider approach)

## References

This document was created after solving screenshot generation issues where:
- Multiple complex approaches failed (html2canvas, style manipulation, Puppeteer)
- Simple solution worked (proxy → base64 → direct capture)
- Root cause was CORS, not rendering complexity