"""
auth.py – MuseFlow FastAPI Authentication Router
-------------------------------------------------
Authentication is now handled entirely by Supabase Auth on the frontend.
This module's job is to:
  1. Provide a reusable FastAPI dependency `get_current_user` that validates
     a Supabase-issued JWT by fetching Supabase's public JWKS endpoint and
     verifying the token signature/claims without needing the JWT secret.
  2. Expose a GET /me endpoint that returns the resolved user identity.
  3. Keep legacy endpoints behind a deprecation notice so existing callers
     don't break during the migration window.
"""

from typing import Any, Dict, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import jwt as pyjwt          # PyJWT (installed as "PyJWT")
from jwt import PyJWKClient  # PyJWT >=2.x bundled JWKSClient
from sqlmodel import Session

from app.core.config import settings
from app.db.session import get_db
from app.db.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------------------------------------------------------------------
# Bearer token extractor – works with Authorization: Bearer <token>
# ---------------------------------------------------------------------------
_bearer = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# JWKS client – lazily initialised once per process lifetime
# Supabase publishes its public keys at /auth/v1/jwks
# ---------------------------------------------------------------------------
_jwks_client: Optional[PyJWKClient] = None

def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


# ---------------------------------------------------------------------------
# Core dependency: resolve and validate the Supabase JWT
# ---------------------------------------------------------------------------
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Validate a Supabase-issued Bearer JWT.

    Returns the decoded JWT payload (which includes `sub`, `email`,
    `user_metadata`, `role`, `aud`, etc.) so downstream routes can read
    the authenticated user's identity without a DB round-trip.

    Raises HTTP 401 if the token is absent, expired, or has an invalid
    signature.
    """
    _unauth = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials – please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        raise _unauth

    token = credentials.credentials

    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)

        payload: Dict[str, Any] = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "HS256", "ES256"],
            audience="authenticated",   # Supabase sets aud = "authenticated"
            options={"verify_exp": True},
        )

        # Ensure a profile row exists in public.profiles for payload["sub"]
        try:
            user_uuid = UUID(payload["sub"])
            user_profile = db.get(User, user_uuid)
            if not user_profile:
                email = payload.get("email", "")
                display_name = (payload.get("user_metadata") or {}).get("display_name")
                avatar_url = (payload.get("user_metadata") or {}).get("avatar_url")
                
                new_profile = User(
                    id=user_uuid,
                    email=email,
                    display_name=display_name,
                    avatar_url=avatar_url,
                    settings={}
                )
                db.add(new_profile)
                db.commit()
                db.refresh(new_profile)
        except Exception as db_err:
            print(f"[Auth] Defensive profiles upsert failed: {db_err}")
            db.rollback()

        return payload

    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired – please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        # Network error fetching JWKS, etc.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Authentication service temporarily unavailable: {exc}",
        )


# ---------------------------------------------------------------------------
# GET /me – return the current authenticated user's identity
# ---------------------------------------------------------------------------
@router.get("/me")
def read_users_me(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Return basic profile information about the currently authenticated user.
    The full profile lives in Supabase's `public.profiles` table.
    """
    return {
        "id": user.get("sub"),
        "email": user.get("email"),
        "display_name": (user.get("user_metadata") or {}).get("display_name"),
        "avatar_url": (user.get("user_metadata") or {}).get("avatar_url"),
        "role": user.get("role"),
        "aud": user.get("aud"),
    }


# ---------------------------------------------------------------------------
# DEPRECATED – legacy local-auth endpoints kept for backward compatibility
# These no longer issue tokens; all auth is handled by Supabase on the client.
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    deprecated=True,
    summary="[DEPRECATED] Use Supabase client-side signUp instead",
    tags=["Authentication"],
)
def register_deprecated():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Local registration is no longer supported. "
            "Use the MuseFlow UI (powered by Supabase Auth) to create an account."
        ),
    )


@router.post(
    "/token",
    deprecated=True,
    summary="[DEPRECATED] Use Supabase client-side signInWithPassword instead",
    tags=["Authentication"],
)
def token_deprecated():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Local token issuance is no longer supported. "
            "Authenticate via the MuseFlow UI and pass the returned Supabase JWT as a Bearer token."
        ),
    )


@router.post(
    "/login",
    deprecated=True,
    summary="[DEPRECATED] Use Supabase client-side signInWithPassword instead",
    tags=["Authentication"],
)
def login_deprecated():
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Local login is no longer supported. "
            "Authenticate via the MuseFlow UI and pass the returned Supabase JWT as a Bearer token."
        ),
    )
