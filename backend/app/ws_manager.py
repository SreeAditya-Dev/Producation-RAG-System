from fastapi import WebSocket
from typing import Dict, List, Any, Optional
from collections import defaultdict
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Tracks WebSocket connections scoped by client_id. Pipeline telemetry (query
    text, retrieved chunk previews, generated answer tokens, document content
    previews) is only ever sent to the browser tab that actually issued that
    request — never broadcast to every connected socket, which would leak one
    user's queries and documents to every other connected user.
    """

    def __init__(self):
        self.connections_by_client: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.connections_by_client[client_id].append(websocket)
        logger.info(
            "WS client connected (client_id=%s). Connections for client: %d",
            client_id, len(self.connections_by_client[client_id]),
        )

    def disconnect(self, websocket: WebSocket, client_id: str):
        conns = self.connections_by_client.get(client_id)
        if conns and websocket in conns:
            conns.remove(websocket)
            if not conns:
                del self.connections_by_client[client_id]
        logger.info("WS client disconnected (client_id=%s).", client_id)

    async def broadcast(
        self,
        event: str,
        data: Any = None,
        document_id: Optional[str] = None,
        query_id: Optional[str] = None,
        client_id: Optional[str] = None,
    ):
        """Send an event only to the connections belonging to `client_id`. No
        client_id means no recipient — pipeline events are never broadcast blind."""
        if not client_id:
            return
        conns = self.connections_by_client.get(client_id)
        if not conns:
            return

        message = {
            "event": event,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if document_id:
            message["document_id"] = document_id
        if query_id:
            message["query_id"] = query_id

        payload = json.dumps(message)
        dead: List[WebSocket] = []

        for connection in conns:
            try:
                await connection.send_text(payload)
            except Exception:
                dead.append(connection)

        for conn in dead:
            self.disconnect(conn, client_id)

    async def send_personal(self, websocket: WebSocket, event: str, data: Any = None):
        message = {
            "event": event,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")


manager = ConnectionManager()
