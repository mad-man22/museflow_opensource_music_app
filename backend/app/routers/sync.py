from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import jwt as pyjwt

from app.routers.auth import _get_jwks_client

router = APIRouter(prefix="/sync", tags=["Real-time Sync"])

class SyncConnectionManager:
    def __init__(self):
        # Maps user_id / room_id -> List of active WebSockets
        self.active_rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = []
        self.active_rooms[room_id].append(websocket)
        print(f"[Sync Manager] WebSocket connected to room: {room_id}. Total connections: {len(self.active_rooms[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_rooms:
            if websocket in self.active_rooms[room_id]:
                self.active_rooms[room_id].remove(websocket)
                print(f"[Sync Manager] WebSocket disconnected from room: {room_id}")
            if not self.active_rooms[room_id]:
                del self.active_rooms[room_id]

    async def broadcast_to_room(self, message: dict, room_id: str, sender: WebSocket):
        if room_id in self.active_rooms:
            for connection in self.active_rooms[room_id]:
                if connection != sender:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        # Clean up failed connections silently
                        print(f"[Sync Manager] Failed broadcast: {e}")

manager = SyncConnectionManager()

@router.websocket("/ws/{room_id}")
async def websocket_sync_endpoint(websocket: WebSocket, room_id: str, token: str = None):
    """
    WebSocket endpoint for real-time player synchronization.
    Clients connect to /ws/{room_id}?token=JWT_TOKEN.
    """
    # Authenticate token if present – use Supabase JWKS verification
    auth_room_id = room_id
    if token:
        try:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "HS256", "ES256"],
                audience="authenticated",
                options={"verify_exp": True},
            )
            user_id = payload.get("sub")
            if user_id:
                # Group by user_id for seamless cross-device sync
                auth_room_id = f"user_{user_id}"
        except pyjwt.InvalidTokenError:
            await websocket.close(code=4003)  # Forbidden
            return
        except Exception:
            # JWKS network error – allow unauthenticated room as fallback
            pass

    await manager.connect(websocket, auth_room_id)
    
    try:
        while True:
            # Receive sync status from client
            # Expected schema: { "event": "play"|"pause"|"seek"|"queue", "trackId": "xyz", "progress": 42.5, "timestamp": 1234567 }
            data = await websocket.receive_json()
            
            # Broadcast state changes to all other connected clients in the room
            await manager.broadcast_to_room(data, auth_room_id, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, auth_room_id)
    except Exception as e:
        print(f"[Sync Endpoint] Error: {e}")
        manager.disconnect(websocket, auth_room_id)
