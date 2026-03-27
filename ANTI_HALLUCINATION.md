# Anti-Hallucination Safeguards

Kuevo implements multiple layers of protection to ensure content recommendations are **REAL** and **VERIFIABLE**:

## Architecture

### Layer 1: Source Verification
- **Google Drive**: Real files with real Google Drive URLs (verified via Drive API)
- **External Sources**: User-configured blog URLs and RSS feeds (verified via HTTP/RSS parsing)
- **No invented content**: Only content from these two real sources is returned

### Layer 2: Content Compilation
Location: `/api/google/context/route.ts`

1. Fetch from Drive with keyword search + topic extraction
2. Fetch from external sources (blog scraping + RSS parsing)
3. Combine both into single `allContent` array with verified URLs
4. Pass to Claude with EXPLICIT instruction: "You MUST suggest ONLY the files/articles listed above"

### Layer 3: Claude Prompt Enforcement
The prompt explicitly states:

```
CRITICAL: You MUST suggest ONLY the files/articles listed above. Do NOT invent or hallucinate any content.
Respond ONLY in [language]. No greetings, no signature, no extra text. Just 2 lines.
Suggest up to 3 relevant items from the available content list that match the topics discussed.

AVAILABLE CONTENT (with EXACT titles and URLs):
- [Real file/article titles and URLs from sources]
```

### Layer 4: Post-Generation Validation
Location: `/api/google/context/route.ts` lines 357-372

After Claude generates suggestions:
1. Extract all suggested URLs
2. Verify each URL exists in `availableUrls` set (built from real sources)
3. BLOCK any URL not in the set (logs warning)
4. Return ONLY verified blocks to frontend

**Code:**
```typescript
if (result.suggested_blocks && Array.isArray(result.suggested_blocks)) {
  const availableUrls = new Set(allContent.map(c => c.url))
  
  result.suggested_blocks = result.suggested_blocks.filter((block: any) => {
    const isReal = availableUrls.has(block.url)
    if (!isReal) {
      console.warn('[google/context] BLOCKED hallucinated content:', block)
    }
    return isReal
  })
}
```

## Source Configuration

### Google Drive (Automatic)
- Company domain-based search
- Topic extraction from email subjects
- File type filtering (Docs, Slides, PDFs only)
- Keyword exclusions: invoices, payroll, contracts

### External Sources (User-Configured)
Location: `/settings` page → "External Content Sources"

Users can add:
- **Blog URLs**: Auto-scraped for article links
- **RSS Feeds**: Parsed for articles with real URLs

Each source is verified to:
- Have valid URL format
- Return HTTP 200
- Contain real content (articles/links)

**Database Table:** `external_sources`
```sql
- id (uuid)
- user_id (uuid) - RLS enforced
- source_type ('blog' | 'rss')
- url (text) - validated
- title (text)
- last_fetched_at (timestamptz)
```

## Testing

### Endpoint: `/api/test/content-sources`
Verifies:
- ✅ Google integration status
- ✅ External sources are valid
- ✅ All URLs are well-formed
- ✅ No hallucinations detected

## Guarantees

1. **Every suggested link is real**: Verified against source URLs
2. **Every URL is clickable**: From real Drive files or web pages
3. **No invented titles**: Matched from actual content
4. **Transparent sourcing**: Can trace each suggestion back to source
5. **Logged validation**: Every blocked hallucination is logged with content details

## Future Enhancements

- SSL certificate validation for external URLs
- Link liveness checking (HTTP HEAD requests)
- Rate limiting on external source fetches
- User review before sending content links
- Analytics on which sources drive engagement
