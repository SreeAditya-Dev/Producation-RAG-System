from typing import List, Dict
from sqlalchemy.orm import Session
from app.database import QueryHistory

class SessionEpisodicMemory:
    """
    Manages episodic dialogue history stored in the relational database.
    Provides structured context window compilation for the active LLM.
    """
    def __init__(self, db: Session, max_history_turns: int = 5):
        self.db = db
        self.max_history_turns = max_history_turns

    def get_recent_episodes(self, session_id: str) -> List[Dict[str, str]]:
        """
        Retrieves recent successful chat episodes as a chronological list
        of dialogue message dicts for prompt ingestion.
        """
        if not session_id:
            return []
            
        records = (
            self.db.query(QueryHistory)
            .filter(
                QueryHistory.session_id == session_id,
                QueryHistory.status == "success"
            )
            .order_by(QueryHistory.created_at.desc())
            .limit(self.max_history_turns)
            .all()
        )
        
        # Chronological order
        records.reverse()
        
        messages = []
        for r in records:
            messages.append({"role": "user", "content": r.question})
            if r.answer:
                messages.append({"role": "assistant", "content": r.answer})
        return messages
