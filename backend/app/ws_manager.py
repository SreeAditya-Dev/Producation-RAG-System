from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WS client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WS client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, event: str, data: Any = None, document_id: str = None, query_id: str = None):
        if not self.active_connections:
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

        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                dead.append(connection)

        for conn in dead:
            self.disconnect(conn)

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
