from typing import List, Dict, Any
from app.services.session_episodic_memory import SessionEpisodicMemory

class HybridMemoryCoordinator:
    """
    Coordinates various memory modules to build a unified working context
    (system prompt, episodic dialogue turns, and retrieved external context).
    """
    def __init__(self, episodic_memory: SessionEpisodicMemory, system_prompt: str):
        self.episodic_memory = episodic_memory
        self.system_prompt = system_prompt

    def compile_working_memory(
        self, 
        session_id: str, 
        user_query: str, 
        context_chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """
        Assembles working memory payload for LLM consumption.
        Combines:
        1. System Prompt (Procedural Memory)
        2. Dialogue History (Episodic Memory)
        3. Context chunks + Current Query (Working / Retrieval Memory)
        """
        messages = [{"role": "system", "content": self.system_prompt}]
        
        # Append sliding session history
        if session_id:
            history = self.episodic_memory.get_recent_episodes(session_id)
            messages.extend(history)
            
        # Format retrieval context
        formatted_context = self._format_context(context_chunks)
        
        # Append current user prompt containing context
        user_content = f"Context:\n{formatted_context}\n\nQuestion: {user_query}"
        messages.append({"role": "user", "content": user_content})
        
        return messages

    def _format_context(self, chunks: List[Dict[str, Any]]) -> str:
        if not chunks:
            return "No relevant context found."
        parts = []
        for i, chunk in enumerate(chunks, 1):
            source = chunk.get("original_name", "Unknown")
            text = chunk.get("text", "")
            parts.append(f"[Source {i}: {source}]\n{text}")
        return "\n\n---\n\n".join(parts)
