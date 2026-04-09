from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.run_service import run_service

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str):
    await websocket.accept()
    await run_service.subscribe(run_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "cancel":
                run_service.cancel_run(run_id)
    except WebSocketDisconnect:
        pass
    finally:
        await run_service.unsubscribe(run_id, websocket)
