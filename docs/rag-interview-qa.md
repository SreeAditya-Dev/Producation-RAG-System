# RAG System — Interview Q&A Reference

A curated set of advanced RAG interview questions with detailed answers, mapped to our production system's architecture.

---

## Q1: How will you store documents in a Vector DB for a production RAG system?

**Naive Answer (❌):**
> "Chunk by paragraph, embed each chunk with OpenAI, dump into Pinecone. At query time, grab top-3 matches and pass to the LLM. Vector similarity handles everything."

**Why This Fails in Production:**
- Paragraph-based chunking is arbitrary — it splits tables, code blocks, and lists mid-content.
- Top-3 results with no reranking often returns near-duplicate chunks (information redundancy).
- No metadata means you can't trace which document or section a chunk came from.
- No overlap means context is lost at chunk boundaries.

**Production Answer (✅) — What Our System Does:**

| Feature | Implementation | File |
|---|---|---|
| **Recursive semantic chunking** | Splits by `\n\n` → `\n` → `. ` → ` ` → `""` hierarchy, not just paragraphs | `app/utils/chunking.py` |
| **Table-aware splitting** | Detects markdown tables, keeps them atomic; large tables get split row-by-row with column headers injected into every chunk | `app/pipeline/table_splitter.py` |
| **Chunk overlap** | 50-character overlap buffer between adjacent chunks to maintain continuity | `app/config.py` |
| **Rich metadata envelope** | Every vector carries `doc_id`, `original_name`, `file_type`, `chunk_index`, `char_start`, `char_end`, `boundary_level` | `app/pipeline/ingestion.py` |
| **Over-fetch + Rerank** | Fetches `top_k × 4` candidates, then cross-encoder reranker selects the best `top_k` | `app/services/reranker_service.py` |
| **MMR diversity filter** | Penalises redundant chunks to ensure coverage across different sections | `app/services/diversity_filter.py` |
| **Faithfulness scoring** | `sigmoid(mean rerank logit)` — estimates hallucination risk before the answer is even generated | `app/pipeline/retrieval.py` |

---

## Q2: Your chatbot takes 10 seconds to reply because you re-send the entire 50-page manual with every prompt. How do you fix it?

**Root Cause:**
Stuffing the entire document into every LLM call wastes tokens, hits context window limits, increases latency, and increases cost linearly with document size.

**Production Answer (✅) — What Our System Does:**

1. **Retrieval-only context** — Only the top-K relevant chunks (default 5) are sent to the LLM, not the full document.
   → `app/pipeline/retrieval.py` — `sources = compressed_sources[:top_k]`

2. **Context Compression** — Even within each chunk, only query-relevant sentences are kept. Sentences are scored by keyword overlap with the query, and a token budget limits total context size.
   → `app/services/context_compressor.py`

3. **Sliding Session Memory** — Only the last 5 conversation turns are included, not the entire chat history. This prevents the prompt from growing unboundedly.
   → `app/services/session_episodic_memory.py` — `max_history_turns = 5`

4. **Hybrid Memory Coordinator** — Assembles a compact working memory payload: `System Prompt + Sliding History + Compressed Context + Current Query`. Nothing more.
   → `app/services/hybrid_memory_coordinator.py`

5. **SSE Token Streaming** — Response tokens stream to the UI as they're generated, so the user sees output immediately instead of waiting for the full response.
   → `app/pipeline/retrieval.py` (generation_token events)

**Result:** Instead of sending 50 pages (~100K tokens) every time, we send ~5 compressed chunks (~1-2K tokens of context). Orders of magnitude cheaper and faster.

---

## Q3: You're building RAG for financial PDFs. Missing a single number can cost millions. What is the best search method?

**Why Dense-Only Search Fails Here:**
Dense (semantic) embeddings encode **meaning**, not exact tokens. The query *"What was the Q3 revenue of ₹14,23,500?"* and a chunk containing that exact number may have moderate cosine similarity — but a chunk discussing *"quarterly revenue trends"* might score higher because it's semantically closer to the question's phrasing. The exact number gets buried.

**Production Answer (✅) — Hybrid Search (Dense + BM25):**

Our system implements a **hybrid retrieval** strategy that merges results from both dense and sparse search:

| Search Type | What It Catches | Implementation |
|---|---|---|
| **Dense (Pinecone HNSW + cosine)** | Semantic meaning — paraphrases, synonyms, conceptual matches | `app/services/pinecone_service.py` |
| **Sparse (Okapi BM25)** | Exact lexical matches — numbers, IDs, currency figures, codes | `app/services/bm25_service.py` |

**How Hybrid Merge Works:**
1. Both dense and BM25 searches run in parallel for each sub-query.
2. Dense matches are added first with their real cosine scores.
3. BM25-only hits (not found by dense search) are appended with a floor score of `0.3` (just above the relevance cutoff).
4. Deduplication by chunk ID ensures no double-counting.
5. The **cross-encoder reranker** (not raw retrieval score) decides the final relevance ranking.

→ `app/pipeline/retrieval.py` (lines 97–168)

**Why the floor score matters:** BM25 rank only decides *inclusion* in the candidate pool. The neural reranker decides real relevance. This prevents a noisy keyword match from outranking a genuinely relevant semantic result.

---

## Q4: Can you explain what a Parent Document Retriever is in RAG systems — and why it is often preferred over traditional chunk-based retrieval?

### What Is a Parent Document Retriever?

A Parent Document Retriever is a two-tier retrieval strategy that decouples **what you search on** from **what you feed the LLM**:

```
┌─────────────────────────────────────────────────────────┐
│                    PARENT DOCUMENT                       │
│  (Full section / page — e.g. 2000 characters)           │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│   │ Child 1  │  │ Child 2  │  │ Child 3  │              │
│   │ (small   │  │ (small   │  │ (small   │              │
│   │  chunk)  │  │  chunk)  │  │  chunk)  │              │
│   │ 200 chars│  │ 200 chars│  │ 200 chars│              │
│   └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

**How it works:**

1. **Indexing Phase:**
   - Split the document into **large parent chunks** (e.g., full sections, 1500–2000 chars).
   - Sub-split each parent into **small child chunks** (e.g., 200–300 chars).
   - Embed and index **only the child chunks** in the vector DB.
   - Store the **parent-child mapping** (e.g., in a document store or SQL table).

2. **Query Phase:**
   - The user's query is embedded and searched against the **small child chunks** (high precision matching).
   - When a child chunk matches, the system **retrieves its parent chunk** instead.
   - The **full parent chunk** (with surrounding context) is sent to the LLM.

### Why Is It Preferred Over Traditional Chunk-Based Retrieval?

| Problem with Standard Chunking | How Parent Retriever Solves It |
|---|---|
| **Small chunks = better search precision** but lose surrounding context for the LLM | Search on small children (precision), but feed parent (context) |
| **Large chunks = better LLM context** but dilute embedding quality, reducing search recall | Small children keep embeddings focused and high-quality |
| **You're forced to pick one chunk size** that's a compromise for both search AND generation | Decouples the two — each gets its optimal size |
| **Adjacent information is lost** — the sentence before/after the matched chunk often contains critical context | Parent chunk naturally includes the surrounding sentences |

### Real-World Example

Suppose a financial report says:

> *"In Q3 2025, the company reported a net revenue of ₹14.2 Cr. This represented a 23% increase over the previous quarter, driven primarily by expansion into Tier-2 markets."*

With standard 200-char chunking, you might match the first sentence but lose the 23% growth context. With Parent Document Retrieval, matching the first sentence pulls back the entire paragraph.

### Is It Implemented in Our System?

**Not directly as a named "Parent Document Retriever"** — but our system addresses the same underlying problem through a different (complementary) set of mechanisms:

| Parent Retriever Goal | Our System's Equivalent |
|---|---|
| **Small chunks for precise search** | 512-char recursive chunks with semantic boundary detection |
| **Retrieve more context than what matched** | Over-fetch `top_k × 4` candidates → rerank → compress to top-K |
| **Don't lose surrounding info** | 50-char chunk overlap ensures boundary context is preserved |
| **Table context preservation** | Table-aware splitter injects column headers into every row chunk |
| **Multi-angle coverage** | Query decomposition searches multiple sub-queries in parallel, MMR diversity filter ensures coverage |

**Trade-off comparison:**

| Aspect | Parent Document Retriever | Our System's Approach |
|---|---|---|
| **Implementation complexity** | Moderate — needs parent-child mapping store | Already built — no additional infrastructure |
| **Token efficiency** | Parents can be large → more tokens to LLM | Context compressor extracts only relevant sentences → fewer tokens |
| **Search precision** | High (small child chunks) | High (512-char chunks + BM25 hybrid) |
| **Context quality** | Good (parent has surrounding context) | Good (overlap + over-fetch + rerank ensures context coverage) |
| **Redundancy control** | No built-in dedup | MMR filter actively penalises redundant chunks |

### When Would You Still Want a Parent Document Retriever?

It's most valuable when:
- Your documents have very **rigid hierarchical structure** (legal contracts, regulatory filings with numbered sections).
- You need **guaranteed surrounding context** — not probabilistic (our overlap + over-fetch is probabilistic, parent retrieval is deterministic).
- Your chunks are **very small** (< 200 chars) for maximum precision, but you need paragraphs for the LLM.

> **Bottom line:** Parent Document Retrieval and our current architecture solve the same core tension (search precision vs. generation context) through different strategies. Neither is strictly superior — they're complementary patterns. Our system's combination of overlap, over-fetch, reranking, and context compression achieves similar results without requiring a separate parent-child document store.
