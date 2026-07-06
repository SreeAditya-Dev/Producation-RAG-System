from typing import List, Dict, Any
from app.services.pinecone_service import pinecone_service
from app.database import Document
from sqlalchemy.orm import Session

class PineconeRetrievalMemory:
    """
    Interface for external vector database memory (Pinecone).
    Retrieves and filters active semantic context chunks.
    """
    def __init__(self, db: Session):
        self.db = db

    def retrieve_context(
        self, 
        query_vector: List[float], 
        top_k: int = 5, 
        score_threshold: float = 0.25
    ) -> List[Dict[str, Any]]:
        """
        Queries Pinecone and filters out stale or low-similarity chunks.
        """
        # Fetch candidate vectors
        raw_matches = pinecone_service.query(
            vector=query_vector,
            top_k=top_k,
            include_values=False
        )
        
        # Get set of active documents
        active_docs = {
            doc_id[0] for doc_id in self.db.query(Document.id).filter(Document.status == "ready").all()
        }
        
        filtered = []
        for m in raw_matches:
            doc_id = m["metadata"].get("doc_id")
            score = m.get("score", 0.0)
            if score >= score_threshold and doc_id in active_docs:
                filtered.append({
                    "doc_id": doc_id,
                    "original_name": m["metadata"].get("original_name", "Unknown"),
                    "chunk_index": m["metadata"].get("chunk_index", 0),
                    "text": m["metadata"].get("text", ""),
                    "score": round(score, 4),
                    "file_type": m["metadata"].get("file_type", ""),
                    "char_start": m["metadata"].get("char_start"),
                    "char_end": m["metadata"].get("char_end"),
                    "boundary_level": m["metadata"].get("boundary_level"),
                })
                
        # Fallback to keep at least some chunks from ready documents if filtered is empty
        if not filtered and raw_matches:
            fallback_count = 0
            for m in raw_matches:
                doc_id = m["metadata"].get("doc_id")
                if doc_id in active_docs and fallback_count < 5:
                    filtered.append({
                        "doc_id": doc_id,
                        "original_name": m["metadata"].get("original_name", "Unknown"),
                        "chunk_index": m["metadata"].get("chunk_index", 0),
                        "text": m["metadata"].get("text", ""),
                        "score": round(m.get("score", 0.0), 4),
                        "file_type": m["metadata"].get("file_type", ""),
                        "char_start": m["metadata"].get("char_start"),
                        "char_end": m["metadata"].get("char_end"),
                        "boundary_level": m["metadata"].get("boundary_level"),
                    })
                    fallback_count += 1
                    
        return filtered
