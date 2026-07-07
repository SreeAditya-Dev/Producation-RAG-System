from app.utils.chunking import RecursiveTextSplitter


def test_short_text_returns_single_chunk():
    splitter = RecursiveTextSplitter(chunk_size=512, chunk_overlap=50)
    chunks = splitter.split("A short sentence that fits in one chunk.")
    assert len(chunks) == 1


def test_long_text_splits_into_multiple_chunks():
    splitter = RecursiveTextSplitter(chunk_size=100, chunk_overlap=20)
    paragraph = "This is a sentence that repeats. " * 20  # ~680 chars
    chunks = splitter.split(paragraph)
    assert len(chunks) > 1
    assert all(len(c) <= 150 for c in chunks)  # allows some overlap slack


def test_chunk_overlap_carries_context_forward():
    splitter = RecursiveTextSplitter(chunk_size=60, chunk_overlap=20)
    text = "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi."
    chunks = splitter.split(text)
    assert len(chunks) > 1
    # Some tail of chunk N should reappear at the head of chunk N+1 (the overlap).
    assert any(chunks[i][-10:].strip() and chunks[i][-10:].strip()[:5] in chunks[i + 1] for i in range(len(chunks) - 1))


def test_metadata_char_offsets_are_monotonic():
    splitter = RecursiveTextSplitter(chunk_size=80, chunk_overlap=10)
    text = "Paragraph one has some words.\n\nParagraph two has some other words. " * 5
    metas = splitter.split_with_metadata(text)
    assert len(metas) > 1
    for i, m in enumerate(metas):
        assert m.chunk_index == i
        assert m.char_start <= m.char_end


def test_empty_text_returns_no_chunks():
    splitter = RecursiveTextSplitter(chunk_size=512, chunk_overlap=50)
    assert splitter.split("") == []
