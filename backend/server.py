from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- Env / DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


# ---------- App / Router ----------
app = FastAPI(title="Wholesaler & Supply Manager")
api_router = APIRouter(prefix="/api")


# ---------- Utilities ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": now_utc() + timedelta(days=30),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie("access_token", access, httponly=True, secure=False,
                        samesite="lax", max_age=60 * 60 * 12, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False,
                        samesite="lax", max_age=60 * 60 * 24 * 30, path="/")


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        user.pop("password_hash", None)
        # Legacy backfill for records missing shop_id/role
        if not user.get("shop_id"):
            user["shop_id"] = user["id"]
        if not user.get("role"):
            user["role"] = "owner"
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_owner(user: dict) -> None:
    if user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only shop owner can do this")


# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    shop_id: Optional[str] = None


class StaffCreateIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


PaymentTerm = Literal["Credit", "Cash", "Depends"]
OrderStatus = Literal["Pending", "Delivered", "Delayed", "Partially Delivered"]


class WholesalerIn(BaseModel):
    name: str
    phone: str = ""
    items: List[str] = []
    payment_terms: PaymentTerm = "Cash"
    credit_period_days: int = 0
    reliability_score: Optional[float] = None
    notes: str = ""


class WholesalerOut(WholesalerIn):
    id: str
    created_at: str


class OrderItemIn(BaseModel):
    item: str
    qty: float
    unit: str = "pcs"
    price: float


class OrderIn(BaseModel):
    wholesaler_id: str
    date_ordered: str  # ISO date
    items: List[OrderItemIn]
    expected_delivery: Optional[str] = None
    actual_delivery: Optional[str] = None
    status: OrderStatus = "Pending"
    discrepancy: Optional[str] = None  # damaged / short / wrong / None
    discrepancy_note: str = ""


class OrderOut(OrderIn):
    id: str
    total: float
    created_at: str


class PaymentIn(BaseModel):
    wholesaler_id: str
    order_id: Optional[str] = None
    date: str
    amount: float
    kind: Literal["Full", "Partial"] = "Partial"
    note: str = ""


class PaymentOut(PaymentIn):
    id: str
    created_at: str


class InventoryItemIn(BaseModel):
    name: str
    current_stock: float = 0
    unit: str = "pcs"
    low_threshold: float = 0


class InventoryItemOut(InventoryItemIn):
    id: str


# ---------- AUTH ROUTES ----------
@api_router.post("/auth/register", response_model=UserOut)
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = new_id()
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name,
        "role": "owner",
        "shop_id": user_id,
        "password_hash": hash_password(payload.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return UserOut(id=user_id, email=email, name=payload.name, role="owner", shop_id=user_id)


@api_router.post("/auth/login", response_model=UserOut)
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return UserOut(id=user["id"], email=email, name=user["name"], role=user.get("role", "owner"), shop_id=user.get("shop_id", user["id"]))


@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user["name"], role=user["role"], shop_id=user["shop_id"])


# ---------- STAFF ----------
@api_router.get("/staff", response_model=List[UserOut])
async def list_staff(user: dict = Depends(get_current_user)):
    docs = await db.users.find({"shop_id": user["shop_id"]}, {"_id": 0, "password_hash": 0}).to_list(200)
    # Include the owner (may not have shop_id set in DB)
    if user.get("role") == "owner" or user.get("role") == "admin":
        owner_in_list = any(d["id"] == user["id"] for d in docs)
        if not owner_in_list:
            docs.append({"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "shop_id": user["shop_id"]})
    return [UserOut(id=d["id"], email=d["email"], name=d["name"], role=d.get("role", "owner"), shop_id=d.get("shop_id", d["id"])) for d in docs]


@api_router.post("/staff", response_model=UserOut)
async def create_staff(payload: StaffCreateIn, user: dict = Depends(get_current_user)):
    require_owner(user)
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    sid = new_id()
    await db.users.insert_one({
        "id": sid, "email": email, "name": payload.name, "role": "staff",
        "shop_id": user["shop_id"], "password_hash": hash_password(payload.password),
        "created_at": iso(now_utc()),
    })
    return UserOut(id=sid, email=email, name=payload.name, role="staff", shop_id=user["shop_id"])


@api_router.delete("/staff/{sid}")
async def delete_staff(sid: str, user: dict = Depends(get_current_user)):
    require_owner(user)
    if sid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    target = await db.users.find_one({"id": sid, "shop_id": user["shop_id"]})
    if not target:
        raise HTTPException(404, "Not found")
    if target.get("role") in ("owner", "admin"):
        raise HTTPException(400, "Cannot delete another owner")
    await db.users.delete_one({"id": sid})
    return {"ok": True}


# ---------- WHOLESALERS ----------
def _scope(user: dict) -> dict:
    return {"owner_id": user.get("shop_id") or user["id"]}


@api_router.post("/wholesalers", response_model=WholesalerOut)
async def create_wholesaler(payload: WholesalerIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["owner_id"] = user["id"]
    doc["created_at"] = iso(now_utc())
    await db.wholesalers.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("owner_id", None)
    return WholesalerOut(**doc)


@api_router.get("/wholesalers", response_model=List[WholesalerOut])
async def list_wholesalers(user: dict = Depends(get_current_user)):
    docs = await db.wholesalers.find(_scope(user), {"_id": 0, "owner_id": 0}).sort("created_at", -1).to_list(500)
    return [WholesalerOut(**d) for d in docs]


@api_router.get("/wholesalers/{wid}", response_model=WholesalerOut)
async def get_wholesaler(wid: str, user: dict = Depends(get_current_user)):
    d = await db.wholesalers.find_one({"id": wid, "owner_id": user["id"]}, {"_id": 0, "owner_id": 0})
    if not d:
        raise HTTPException(404, "Not found")
    return WholesalerOut(**d)


@api_router.put("/wholesalers/{wid}", response_model=WholesalerOut)
async def update_wholesaler(wid: str, payload: WholesalerIn, user: dict = Depends(get_current_user)):
    upd = payload.model_dump()
    r = await db.wholesalers.update_one({"id": wid, "owner_id": user["id"]}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    d = await db.wholesalers.find_one({"id": wid}, {"_id": 0, "owner_id": 0})
    return WholesalerOut(**d)


@api_router.delete("/wholesalers/{wid}")
async def delete_wholesaler(wid: str, user: dict = Depends(get_current_user)):
    await db.wholesalers.delete_one({"id": wid, "owner_id": user["id"]})
    return {"ok": True}


# ---------- ORDERS ----------
def _order_total(items: List[dict]) -> float:
    return round(sum(float(i["qty"]) * float(i["price"]) for i in items), 2)


@api_router.post("/orders", response_model=OrderOut)
async def create_order(payload: OrderIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["owner_id"] = user["id"]
    doc["created_at"] = iso(now_utc())
    doc["total"] = _order_total(doc["items"])
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("owner_id", None)
    return OrderOut(**doc)


@api_router.get("/orders", response_model=List[OrderOut])
async def list_orders(wholesaler_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = _scope(user)
    if wholesaler_id:
        q["wholesaler_id"] = wholesaler_id
    docs = await db.orders.find(q, {"_id": 0, "owner_id": 0}).sort("date_ordered", -1).to_list(1000)
    return [OrderOut(**d) for d in docs]


@api_router.put("/orders/{oid}", response_model=OrderOut)
async def update_order(oid: str, payload: OrderIn, user: dict = Depends(get_current_user)):
    upd = payload.model_dump()
    upd["total"] = _order_total(upd["items"])
    r = await db.orders.update_one({"id": oid, "owner_id": user["id"]}, {"$set": upd})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    d = await db.orders.find_one({"id": oid}, {"_id": 0, "owner_id": 0})
    return OrderOut(**d)


@api_router.delete("/orders/{oid}")
async def delete_order(oid: str, user: dict = Depends(get_current_user)):
    await db.orders.delete_one({"id": oid, "owner_id": user["id"]})
    return {"ok": True}


# ---------- PAYMENTS ----------
@api_router.post("/payments", response_model=PaymentOut)
async def create_payment(payload: PaymentIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["owner_id"] = user["id"]
    doc["created_at"] = iso(now_utc())
    await db.payments.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("owner_id", None)
    return PaymentOut(**doc)


@api_router.get("/payments", response_model=List[PaymentOut])
async def list_payments(wholesaler_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = _scope(user)
    if wholesaler_id:
        q["wholesaler_id"] = wholesaler_id
    docs = await db.payments.find(q, {"_id": 0, "owner_id": 0}).sort("date", -1).to_list(1000)
    return [PaymentOut(**d) for d in docs]


@api_router.delete("/payments/{pid}")
async def delete_payment(pid: str, user: dict = Depends(get_current_user)):
    await db.payments.delete_one({"id": pid, "owner_id": user["id"]})
    return {"ok": True}


# ---------- INVENTORY ----------
@api_router.post("/inventory", response_model=InventoryItemOut)
async def create_item(payload: InventoryItemIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["owner_id"] = user["id"]
    await db.inventory.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("owner_id", None)
    return InventoryItemOut(**doc)


@api_router.get("/inventory", response_model=List[InventoryItemOut])
async def list_inventory(user: dict = Depends(get_current_user)):
    docs = await db.inventory.find(_scope(user), {"_id": 0, "owner_id": 0}).sort("name", 1).to_list(1000)
    return [InventoryItemOut(**d) for d in docs]


@api_router.put("/inventory/{iid}", response_model=InventoryItemOut)
async def update_item(iid: str, payload: InventoryItemIn, user: dict = Depends(get_current_user)):
    r = await db.inventory.update_one({"id": iid, "owner_id": user["id"]}, {"$set": payload.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    d = await db.inventory.find_one({"id": iid}, {"_id": 0, "owner_id": 0})
    return InventoryItemOut(**d)


@api_router.delete("/inventory/{iid}")
async def delete_item(iid: str, user: dict = Depends(get_current_user)):
    await db.inventory.delete_one({"id": iid, "owner_id": user["id"]})
    return {"ok": True}


# ---------- ANALYTICS ----------
async def _compute_balances(user: dict) -> dict:
    """Returns {wholesaler_id: {owed, oldest_credit_order_date, oldest_credit_days}}."""
    wholesalers = await db.wholesalers.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(500)
    orders = await db.orders.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(2000)
    payments = await db.payments.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(2000)

    by_w = {w["id"]: {"wholesaler": w, "billed": 0.0, "paid": 0.0, "oldest_unpaid_date": None} for w in wholesalers}
    for o in orders:
        w = by_w.get(o["wholesaler_id"])
        if not w:
            continue
        w["billed"] += float(o.get("total", 0))
        d = o.get("date_ordered")
        if d and (w["oldest_unpaid_date"] is None or d < w["oldest_unpaid_date"]):
            w["oldest_unpaid_date"] = d
    for p in payments:
        w = by_w.get(p["wholesaler_id"])
        if not w:
            continue
        w["paid"] += float(p.get("amount", 0))
    return by_w


@api_router.get("/analytics/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    balances = await _compute_balances(user)
    total_owed = 0.0
    overdue_count = 0
    per_w = []
    today = now_utc().date()
    for wid, info in balances.items():
        owed = round(info["billed"] - info["paid"], 2)
        total_owed += max(owed, 0)
        w = info["wholesaler"]
        status = "green"
        days_overdue = 0
        due_date = None
        if owed > 0 and w.get("payment_terms") == "Credit" and info["oldest_unpaid_date"]:
            try:
                base = datetime.fromisoformat(info["oldest_unpaid_date"]).date()
                due = base + timedelta(days=int(w.get("credit_period_days") or 0))
                due_date = due.isoformat()
                delta = (today - due).days
                if delta > 0:
                    status = "red"
                    days_overdue = delta
                    overdue_count += 1
                elif delta > -3:
                    status = "yellow"
            except Exception:
                pass
        elif owed > 0:
            status = "yellow"
        per_w.append({
            "wholesaler_id": wid,
            "name": w["name"],
            "payment_terms": w.get("payment_terms"),
            "owed": owed,
            "status": status,
            "due_date": due_date,
            "days_overdue": days_overdue,
        })

    orders = await db.orders.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(1000)
    pending_orders = sum(1 for o in orders if o.get("status") in ("Pending", "Delayed", "Partially Delivered"))

    inv = await db.inventory.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(1000)
    low_stock = [i for i in inv if float(i.get("current_stock", 0)) <= float(i.get("low_threshold", 0))]

    return {
        "total_owed": round(total_owed, 2),
        "overdue_count": overdue_count,
        "pending_orders": pending_orders,
        "low_stock_count": len(low_stock),
        "per_wholesaler": sorted(per_w, key=lambda x: -x["owed"]),
        "low_stock_items": low_stock,
    }


@api_router.get("/analytics/price-comparison")
async def price_comparison(user: dict = Depends(get_current_user)):
    """For each item name, list wholesalers with latest price + full history."""
    orders = await db.orders.find(_scope(user), {"_id": 0, "owner_id": 0}).sort("date_ordered", 1).to_list(2000)
    wholesalers = {w["id"]: w for w in await db.wholesalers.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(500)}

    items: dict = {}
    for o in orders:
        for it in o.get("items", []):
            name = it["item"].strip().lower()
            if not name:
                continue
            entry = items.setdefault(name, {"item": it["item"], "wholesalers": {}})
            wid = o["wholesaler_id"]
            w = entry["wholesalers"].setdefault(wid, {
                "wholesaler_id": wid,
                "wholesaler_name": wholesalers.get(wid, {}).get("name", "Unknown"),
                "history": [],
            })
            w["history"].append({"date": o["date_ordered"], "price": float(it["price"])})

    out = []
    for e in items.values():
        rows = []
        for w in e["wholesalers"].values():
            w["history"].sort(key=lambda x: x["date"])
            latest = w["history"][-1]["price"] if w["history"] else 0
            first = w["history"][0]["price"] if w["history"] else 0
            trend = "flat"
            if latest > first * 1.02:
                trend = "up"
            elif latest < first * 0.98:
                trend = "down"
            rows.append({**w, "latest_price": latest, "trend": trend})
        if not rows:
            continue
        min_price = min(r["latest_price"] for r in rows)
        for r in rows:
            r["is_lowest"] = r["latest_price"] == min_price
        out.append({"item": e["item"], "wholesalers": sorted(rows, key=lambda x: x["latest_price"])})
    return sorted(out, key=lambda x: x["item"].lower())


@api_router.get("/analytics/reorder-suggestions")
async def reorder_suggestions(user: dict = Depends(get_current_user)):
    """For each low-stock item, suggest best wholesaler (lowest price + fewest issues)."""
    inv = await db.inventory.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(1000)
    low = [i for i in inv if float(i.get("current_stock", 0)) <= float(i.get("low_threshold", 0))]
    if not low:
        return []

    pc = await price_comparison(user)
    pc_map = {p["item"].strip().lower(): p for p in pc}

    orders = await db.orders.find(_scope(user), {"_id": 0, "owner_id": 0}).to_list(2000)
    issues_per_w: dict = {}
    for o in orders:
        if o.get("status") in ("Delayed", "Partially Delivered") or o.get("discrepancy"):
            issues_per_w[o["wholesaler_id"]] = issues_per_w.get(o["wholesaler_id"], 0) + 1

    result = []
    for i in low:
        entry = pc_map.get(i["name"].strip().lower())
        best = None
        if entry:
            candidates = list(entry["wholesalers"])
            candidates.sort(key=lambda r: (r["latest_price"], issues_per_w.get(r["wholesaler_id"], 0)))
            best = candidates[0] if candidates else None
        result.append({
            "item": i["name"],
            "current_stock": i["current_stock"],
            "unit": i["unit"],
            "low_threshold": i["low_threshold"],
            "suggested_wholesaler": best,
            "issue_count_for_best": issues_per_w.get(best["wholesaler_id"], 0) if best else 0,
        })
    return result


# ---------- SEED ----------
async def seed_admin_and_demo():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@kirana.local").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        admin_id = new_id()
        await db.users.insert_one({
            "id": admin_id,
            "email": admin_email,
            "name": "Shop Owner",
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "created_at": iso(now_utc()),
        })
    else:
        admin_id = admin["id"]
        if not verify_password(admin_password, admin["password_hash"]):
            await db.users.update_one({"id": admin_id}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Demo data (only if this user has none)
    existing_w = await db.wholesalers.count_documents({"owner_id": admin_id})
    if existing_w > 0:
        return

    today = now_utc().date()

    def d(offset):
        return (today + timedelta(days=offset)).isoformat()

    ws = [
        {"name": "Sharma Traders", "phone": "9812345601", "items": ["Rice", "Dal", "Sugar"],
         "payment_terms": "Credit", "credit_period_days": 15, "notes": "Delhi APMC"},
        {"name": "Gupta Wholesale", "phone": "9812345602", "items": ["Atta", "Maida", "Besan"],
         "payment_terms": "Credit", "credit_period_days": 30, "notes": "Monthly settlement"},
        {"name": "Verma Distributors", "phone": "9812345603", "items": ["Cooking Oil", "Ghee"],
         "payment_terms": "Cash", "credit_period_days": 0, "notes": "COD only"},
        {"name": "Singh & Sons", "phone": "9812345604", "items": ["Tea", "Biscuits", "Namkeen"],
         "payment_terms": "Depends", "credit_period_days": 7, "notes": "Sometimes credit for bulk"},
        {"name": "Patel Masala Bhandar", "phone": "9812345605", "items": ["Haldi", "Mirch", "Jeera", "Dhaniya"],
         "payment_terms": "Credit", "credit_period_days": 20, "notes": "Spices supplier"},
        {"name": "Modern Dairy", "phone": "9812345606", "items": ["Milk", "Paneer", "Curd"],
         "payment_terms": "Cash", "credit_period_days": 0, "notes": "Daily delivery"},
    ]
    wholesaler_ids = {}
    for w in ws:
        wid = new_id()
        wholesaler_ids[w["name"]] = wid
        await db.wholesalers.insert_one({
            **w, "id": wid, "owner_id": admin_id, "created_at": iso(now_utc()),
        })

    orders_seed = [
        {"w": "Sharma Traders", "day": -25, "exp": -22, "act": -22, "status": "Delivered",
         "items": [{"item": "Rice", "qty": 50, "unit": "kg", "price": 42}, {"item": "Dal", "qty": 20, "unit": "kg", "price": 95}]},
        {"w": "Sharma Traders", "day": -8, "exp": -5, "act": None, "status": "Pending",
         "items": [{"item": "Rice", "qty": 40, "unit": "kg", "price": 45}, {"item": "Sugar", "qty": 25, "unit": "kg", "price": 44}]},
        {"w": "Gupta Wholesale", "day": -35, "exp": -32, "act": -30, "status": "Delivered",
         "items": [{"item": "Atta", "qty": 50, "unit": "kg", "price": 34}, {"item": "Besan", "qty": 15, "unit": "kg", "price": 88}]},
        {"w": "Gupta Wholesale", "day": -10, "exp": -7, "act": -6, "status": "Delivered",
         "items": [{"item": "Atta", "qty": 60, "unit": "kg", "price": 36}, {"item": "Maida", "qty": 20, "unit": "kg", "price": 40}], "discrepancy": "short", "discrepancy_note": "2kg maida kam aaya"},
        {"w": "Verma Distributors", "day": -6, "exp": -4, "act": -4, "status": "Delivered",
         "items": [{"item": "Cooking Oil", "qty": 30, "unit": "L", "price": 145}]},
        {"w": "Singh & Sons", "day": -3, "exp": -1, "act": None, "status": "Delayed",
         "items": [{"item": "Tea", "qty": 10, "unit": "kg", "price": 320}, {"item": "Biscuits", "qty": 40, "unit": "pkt", "price": 25}]},
        {"w": "Patel Masala Bhandar", "day": -18, "exp": -15, "act": -14, "status": "Delivered",
         "items": [{"item": "Haldi", "qty": 5, "unit": "kg", "price": 240}, {"item": "Mirch", "qty": 3, "unit": "kg", "price": 380}, {"item": "Jeera", "qty": 4, "unit": "kg", "price": 420}]},
        {"w": "Patel Masala Bhandar", "day": -2, "exp": 1, "act": None, "status": "Pending",
         "items": [{"item": "Haldi", "qty": 4, "unit": "kg", "price": 260}, {"item": "Dhaniya", "qty": 6, "unit": "kg", "price": 210}]},
        {"w": "Modern Dairy", "day": -1, "exp": -1, "act": -1, "status": "Partially Delivered",
         "items": [{"item": "Milk", "qty": 20, "unit": "L", "price": 58}, {"item": "Paneer", "qty": 3, "unit": "kg", "price": 320}], "discrepancy": "damaged", "discrepancy_note": "1 paneer packet leak"},
    ]
    for o in orders_seed:
        oid = new_id()
        doc = {
            "id": oid, "owner_id": admin_id,
            "wholesaler_id": wholesaler_ids[o["w"]],
            "date_ordered": d(o["day"]),
            "expected_delivery": d(o["exp"]) if o.get("exp") is not None else None,
            "actual_delivery": d(o["act"]) if o.get("act") is not None else None,
            "items": o["items"],
            "status": o["status"],
            "discrepancy": o.get("discrepancy"),
            "discrepancy_note": o.get("discrepancy_note", ""),
            "total": _order_total(o["items"]),
            "created_at": iso(now_utc()),
        }
        await db.orders.insert_one(doc)

    payments_seed = [
        {"w": "Sharma Traders", "day": -20, "amount": 4000, "kind": "Partial"},
        {"w": "Gupta Wholesale", "day": -22, "amount": 3020, "kind": "Full", "note": "Cleared Aug bill"},
        {"w": "Verma Distributors", "day": -4, "amount": 4350, "kind": "Full"},
        {"w": "Patel Masala Bhandar", "day": -12, "amount": 2000, "kind": "Partial"},
    ]
    for p in payments_seed:
        await db.payments.insert_one({
            "id": new_id(), "owner_id": admin_id,
            "wholesaler_id": wholesaler_ids[p["w"]],
            "date": d(p["day"]),
            "amount": p["amount"],
            "kind": p["kind"],
            "note": p.get("note", ""),
            "created_at": iso(now_utc()),
        })

    inv_seed = [
        {"name": "Rice", "current_stock": 12, "unit": "kg", "low_threshold": 20},
        {"name": "Atta", "current_stock": 35, "unit": "kg", "low_threshold": 20},
        {"name": "Sugar", "current_stock": 6, "unit": "kg", "low_threshold": 10},
        {"name": "Cooking Oil", "current_stock": 18, "unit": "L", "low_threshold": 10},
        {"name": "Haldi", "current_stock": 1.5, "unit": "kg", "low_threshold": 2},
        {"name": "Tea", "current_stock": 4, "unit": "kg", "low_threshold": 3},
        {"name": "Milk", "current_stock": 8, "unit": "L", "low_threshold": 15},
    ]
    for it in inv_seed:
        await db.inventory.insert_one({**it, "id": new_id(), "owner_id": admin_id})


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.wholesalers.create_index("owner_id")
    await db.orders.create_index("owner_id")
    await db.payments.create_index("owner_id")
    await db.inventory.create_index("owner_id")
    await seed_admin_and_demo()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# Health
@api_router.get("/")
async def root():
    return {"service": "kirana-supply-manager", "ok": True}


app.include_router(api_router)

_cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
if _cors_origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
