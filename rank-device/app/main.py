from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import sqlite3
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import qrcode
from fastapi import FastAPI, Form, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, PlainTextResponse, RedirectResponse, StreamingResponse

APP_NAME = os.getenv("APP_NAME", "Rank Device")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me-now")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/rank_device.db")
DEFAULT_WHATSAPP_NUMBER = os.getenv("DEFAULT_WHATSAPP_NUMBER", "22900000000")
POWERED_BY = os.getenv("POWERED_BY", "afrIAgenesis®")
SESSION_COOKIE = "rank_device_admin"

app = FastAPI(title=APP_NAME)

CSS = """
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#211709;background:#fff7ea}body{margin:0}.wrap{max-width:1080px;margin:auto;padding:24px}.hero,.card,.poster{background:#fff;border:1px solid #f0d7b3;border-radius:24px;padding:24px;box-shadow:0 12px 36px #5b351015}.grid{display:grid;gap:16px}.grid2{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.btn{display:inline-block;padding:12px 16px;border-radius:14px;border:1px solid #c7812d;background:#fff;color:#5b3510;text-decoration:none;font-weight:700}.primary,.whatsapp{background:#2f7d32;color:white;border-color:#2f7d32}.danger{background:#842029;color:#fff;border-color:#842029}.muted{color:#6f655a}.top{display:flex;gap:12px;justify-content:space-between;align-items:center;flex-wrap:wrap}.products{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.field{display:grid;gap:6px;margin-bottom:12px}.field input,.field textarea,.field select{padding:12px;border:1px solid #d8b98b;border-radius:12px;font:inherit}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.stat{background:#fff3dc;border-radius:18px;padding:16px}.qr{max-width:280px;width:100%}.poster{text-align:center;max-width:520px}.poster img{width:300px;max-width:90%}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #f0d7b3;text-align:left}@media(max-width:680px){.wrap{padding:14px}.hero,.card{padding:18px;border-radius:18px}}
"""

def db() -> sqlite3.Connection:
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def now() -> str:
    return datetime.now(timezone.utc).isoformat()

def slugify(text: str) -> str:
    value = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value or "merchant"

def clean_phone(phone: str) -> str:
    return re.sub(r"\D+", "", phone or DEFAULT_WHATSAPP_NUMBER)

def ip_hash(request: Request) -> str:
    raw = f"{request.client.host if request.client else ''}:{SECRET_KEY}"
    return hashlib.sha256(raw.encode()).hexdigest()

def public_url(slug: str) -> str:
    return f"{PUBLIC_BASE_URL}/m/{slug}"

def html_page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(f"<!doctype html><html lang='fr'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{title}</title><style>{CSS}</style></head><body><main class='wrap'>{body}<p class='muted'>Powered by {POWERED_BY}</p></main></body></html>")

def init_db() -> None:
    with db() as conn:
        conn.executescript("""
        create table if not exists merchants(
          id integer primary key autoincrement,
          slug text unique not null,
          business_name text not null,
          owner_name text,
          category text not null,
          description text not null,
          country text default 'Bénin',
          city text default 'Cotonou',
          market_name text default 'Dantokpa',
          location_note text,
          whatsapp_number text not null,
          opening_hours text,
          delivery_available integer default 0,
          payment_methods text,
          status text default 'active',
          subscription_plan text default 'pilot',
          subscription_status text default 'trial',
          monthly_price_fcfa integer default 0,
          created_at text not null,
          updated_at text not null
        );
        create table if not exists products(
          id integer primary key autoincrement,
          merchant_id integer not null,
          name text not null,
          description text,
          price_text text,
          image_url text,
          is_active integer default 1,
          sort_order integer default 0,
          created_at text not null,
          foreign key(merchant_id) references merchants(id) on delete cascade
        );
        create table if not exists tracking_events(
          id integer primary key autoincrement,
          merchant_id integer not null,
          product_id integer,
          event_type text not null,
          source text,
          referrer text,
          user_agent text,
          ip_hash text,
          created_at text not null,
          foreign key(merchant_id) references merchants(id) on delete cascade
        );
        """)
        existing = conn.execute("select id from merchants where slug=?", ("reine-pagne-dantokpa",)).fetchone()
        if not existing:
            ts = now()
            cur = conn.execute("""insert into merchants(slug,business_name,owner_name,category,description,country,city,market_name,location_note,whatsapp_number,opening_hours,delivery_available,payment_methods,status,subscription_plan,subscription_status,monthly_price_fcfa,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", ("reine-pagne-dantokpa", "Reine Pagne Dantokpa", "Reine", "Pagnes et tissus", "Vente de pagnes, tissus de cérémonie et modèles pour femmes. Livraison possible à Cotonou selon disponibilité.", "Bénin", "Cotonou", "Dantokpa", "Couloir tissus", DEFAULT_WHATSAPP_NUMBER, "8h-18h", 1, "Espèces, Mobile Money", "active", "pilot", "trial", 0, ts, ts))
            mid = cur.lastrowid
            for i, name in enumerate(["Pagne wax cérémonie", "Tissu basin riche", "Pagne quotidien", "Modèle couple", "Tissu femme événement"]):
                conn.execute("insert into products(merchant_id,name,description,price_text,is_active,sort_order,created_at) values(?,?,?,?,?,?,?)", (mid, name, "Disponible selon stock.", "Prix sur demande", 1, i, ts))

@app.on_event("startup")
def startup() -> None:
    init_db()

@app.get("/health")
def health():
    return {"status": "ok", "service": APP_NAME}

@app.head("/")
def head_root():
    return Response(status_code=200)

@app.get("/", response_class=HTMLResponse)
def home():
    body = """
    <section class='hero'><h1>Rank Device</h1><p>Fiches digitales, QR codes et WhatsApp pour petits marchands.</p><p><a class='btn primary' href='/admin/login'>Admin</a> <a class='btn' href='/directory'>Voir l'annuaire</a></p></section>
    """
    return html_page("Rank Device", body)

@app.get("/static/style.css")
def css():
    return PlainTextResponse(CSS, media_type="text/css")

def require_admin(request: Request) -> bool:
    return request.cookies.get(SESSION_COOKIE) == hashlib.sha256((ADMIN_PASSWORD + SECRET_KEY).encode()).hexdigest()

def admin_redirect():
    return RedirectResponse("/admin/login", status_code=303)

@app.get("/admin/login", response_class=HTMLResponse)
def login_page():
    return html_page("Admin", "<section class='card'><h1>Connexion admin</h1><form method='post'><div class='field'><label>Mot de passe</label><input name='password' type='password'></div><button class='btn primary'>Entrer</button></form></section>")

@app.post("/admin/login")
def login(password: str = Form(...)):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Mot de passe incorrect")
    token = hashlib.sha256((ADMIN_PASSWORD + SECRET_KEY).encode()).hexdigest()
    res = RedirectResponse("/admin", status_code=303)
    res.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")
    return res

@app.get("/admin/logout")
def logout():
    res = RedirectResponse("/", status_code=303)
    res.delete_cookie(SESSION_COOKIE)
    return res

@app.get("/admin", response_class=HTMLResponse)
def admin(request: Request):
    if not require_admin(request): return admin_redirect()
    with db() as conn:
        stats = conn.execute("""select count(*) merchants, sum(case when status='active' then 1 else 0 end) active from merchants""").fetchone()
        events = conn.execute("select event_type,count(*) c from tracking_events group by event_type").fetchall()
        top = conn.execute("""select m.slug,m.business_name,count(e.id) c from merchants m left join tracking_events e on e.merchant_id=m.id group by m.id order by c desc limit 10""").fetchall()
    event_html = ''.join(f"<div class='stat'><b>{r['c']}</b><br>{r['event_type']}</div>" for r in events) or "<div class='stat'>Aucun événement</div>"
    top_html = ''.join(f"<tr><td><a href='/m/{r['slug']}'>{r['business_name']}</a></td><td>{r['c']}</td></tr>" for r in top)
    body = f"<div class='top'><h1>Dashboard</h1><p><a class='btn primary' href='/admin/merchants/new'>Créer marchand</a> <a class='btn' href='/admin/merchants'>Marchands</a> <a class='btn' href='/admin/export/merchants.csv'>Export marchands</a> <a class='btn' href='/admin/export/events.csv'>Export événements</a> <a class='btn danger' href='/admin/logout'>Sortir</a></p></div><section class='stats'><div class='stat'><b>{stats['merchants'] or 0}</b><br>Marchands</div><div class='stat'><b>{stats['active'] or 0}</b><br>Actifs</div>{event_html}</section><section class='card'><h2>Top fiches</h2><table><tr><th>Marchand</th><th>Interactions</th></tr>{top_html}</table></section>"
    return html_page("Admin", body)

@app.get("/admin/merchants", response_class=HTMLResponse)
def merchants_admin(request: Request):
    if not require_admin(request): return admin_redirect()
    rows = db().execute("select * from merchants order by updated_at desc").fetchall()
    items = ''.join(f"<tr><td>{r['business_name']}</td><td>{r['category']}</td><td>{r['status']}</td><td><a class='btn' href='/m/{r['slug']}'>Voir</a> <a class='btn' href='/admin/merchants/{r['id']}/edit'>Modifier</a></td></tr>" for r in rows)
    return html_page("Marchands", f"<div class='top'><h1>Marchands</h1><a class='btn primary' href='/admin/merchants/new'>Nouveau</a></div><section class='card'><table><tr><th>Nom</th><th>Catégorie</th><th>Statut</th><th></th></tr>{items}</table></section>")

def merchant_form(action: str, r: Optional[sqlite3.Row] = None) -> str:
    def v(k, d=''):
        return (r[k] if r and k in r.keys() and r[k] is not None else d)
    return f"""<section class='card'><h1>Fiche marchand</h1><form method='post' action='{action}'>
    <div class='field'><label>Nom commercial</label><input name='business_name' value='{v('business_name')}' required></div>
    <div class='field'><label>Catégorie</label><input name='category' value='{v('category')}' required></div>
    <div class='field'><label>Description</label><textarea name='description' required>{v('description')}</textarea></div>
    <div class='grid grid2'><div class='field'><label>Pays</label><input name='country' value='{v('country','Bénin')}'></div><div class='field'><label>Ville</label><input name='city' value='{v('city','Cotonou')}'></div><div class='field'><label>Marché</label><input name='market_name' value='{v('market_name','Dantokpa')}'></div><div class='field'><label>Zone</label><input name='location_note' value='{v('location_note')}'></div></div>
    <div class='grid grid2'><div class='field'><label>WhatsApp</label><input name='whatsapp_number' value='{v('whatsapp_number', DEFAULT_WHATSAPP_NUMBER)}' required></div><div class='field'><label>Horaires</label><input name='opening_hours' value='{v('opening_hours')}'></div><div class='field'><label>Paiements</label><input name='payment_methods' value='{v('payment_methods')}'></div><div class='field'><label>Prix mensuel FCFA</label><input name='monthly_price_fcfa' value='{v('monthly_price_fcfa',0)}'></div></div>
    <div class='field'><label>Statut</label><select name='status'><option>active</option><option>paused</option><option>archived</option></select></div>
    <div class='field'><label>Produits — une ligne par produit, format: nom | prix | description</label><textarea name='products' rows='8'></textarea></div>
    <button class='btn primary'>Enregistrer</button></form></section>"""

@app.get("/admin/merchants/new", response_class=HTMLResponse)
def new_merchant(request: Request):
    if not require_admin(request): return admin_redirect()
    return html_page("Nouveau marchand", merchant_form("/admin/merchants"))

@app.post("/admin/merchants")
def create_merchant(request: Request, business_name: str = Form(...), category: str = Form(...), description: str = Form(...), country: str = Form("Bénin"), city: str = Form("Cotonou"), market_name: str = Form("Dantokpa"), location_note: str = Form(""), whatsapp_number: str = Form(...), opening_hours: str = Form(""), payment_methods: str = Form(""), status: str = Form("active"), monthly_price_fcfa: int = Form(0), products: str = Form("")):
    if not require_admin(request): return admin_redirect()
    slug = slugify(business_name)
    ts = now()
    with db() as conn:
        i = 1
        base = slug
        while conn.execute("select id from merchants where slug=?", (slug,)).fetchone():
            i += 1; slug = f"{base}-{i}"
        cur = conn.execute("insert into merchants(slug,business_name,category,description,country,city,market_name,location_note,whatsapp_number,opening_hours,payment_methods,status,monthly_price_fcfa,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (slug,business_name,category,description,country,city,market_name,location_note,clean_phone(whatsapp_number),opening_hours,payment_methods,status,monthly_price_fcfa,ts,ts))
        mid = cur.lastrowid
        for order, line in enumerate([x.strip() for x in products.splitlines() if x.strip()]):
            parts = [p.strip() for p in line.split('|')]
            conn.execute("insert into products(merchant_id,name,price_text,description,is_active,sort_order,created_at) values(?,?,?,?,?,?,?)", (mid, parts[0], parts[1] if len(parts)>1 else "Prix sur demande", parts[2] if len(parts)>2 else "", 1, order, ts))
    return RedirectResponse(f"/m/{slug}", status_code=303)

@app.get("/admin/merchants/{merchant_id}/edit", response_class=HTMLResponse)
def edit_merchant(request: Request, merchant_id: int):
    if not require_admin(request): return admin_redirect()
    r = db().execute("select * from merchants where id=?", (merchant_id,)).fetchone()
    if not r: raise HTTPException(404)
    return html_page("Modifier", merchant_form(f"/admin/merchants/{merchant_id}/edit", r))

@app.post("/admin/merchants/{merchant_id}/edit")
def update_merchant(request: Request, merchant_id: int, business_name: str = Form(...), category: str = Form(...), description: str = Form(...), country: str = Form("Bénin"), city: str = Form("Cotonou"), market_name: str = Form("Dantokpa"), location_note: str = Form(""), whatsapp_number: str = Form(...), opening_hours: str = Form(""), payment_methods: str = Form(""), status: str = Form("active"), monthly_price_fcfa: int = Form(0), products: str = Form("")):
    if not require_admin(request): return admin_redirect()
    with db() as conn:
        conn.execute("update merchants set business_name=?,category=?,description=?,country=?,city=?,market_name=?,location_note=?,whatsapp_number=?,opening_hours=?,payment_methods=?,status=?,monthly_price_fcfa=?,updated_at=? where id=?", (business_name,category,description,country,city,market_name,location_note,clean_phone(whatsapp_number),opening_hours,payment_methods,status,monthly_price_fcfa,now(),merchant_id))
    return RedirectResponse("/admin/merchants", status_code=303)

def get_merchant(slug: str) -> sqlite3.Row:
    r = db().execute("select * from merchants where slug=? and status!='archived'", (slug,)).fetchone()
    if not r: raise HTTPException(404)
    return r

def track(request: Request, merchant_id: int, event_type: str, source: str = "") -> None:
    with db() as conn:
        conn.execute("insert into tracking_events(merchant_id,event_type,source,referrer,user_agent,ip_hash,created_at) values(?,?,?,?,?,?,?)", (merchant_id,event_type,source,request.headers.get('referer',''),request.headers.get('user-agent',''),ip_hash(request),now()))

@app.get("/directory", response_class=HTMLResponse)
def directory():
    rows = db().execute("select * from merchants where status='active' order by updated_at desc").fetchall()
    cards = ''.join(f"<article class='card'><h2>{r['business_name']}</h2><p>{r['category']} · {r['market_name']} · {r['city']}</p><p>{r['description']}</p><a class='btn primary' href='/m/{r['slug']}'>Voir la fiche</a></article>" for r in rows)
    return html_page("Annuaire", f"<h1>Annuaire Rank Device</h1><section class='grid grid2'>{cards}</section>")

@app.get("/m/{slug}", response_class=HTMLResponse)
def merchant_public(request: Request, slug: str):
    m = get_merchant(slug); track(request, m['id'], 'view', request.query_params.get('source','direct'))
    products = db().execute("select * from products where merchant_id=? and is_active=1 order by sort_order,id", (m['id'],)).fetchall()
    prod = ''.join(f"<article class='card'><h3>{p['name']}</h3><p>{p['description'] or ''}</p><p><b>{p['price_text'] or 'Prix sur demande'}</b></p><a class='btn whatsapp' href='/m/{slug}/contact?product_id={p['id']}&source=product'>Demander sur WhatsApp</a></article>" for p in products)
    body = f"<section class='hero'><h1>{m['business_name']}</h1><p><b>{m['category']}</b> · {m['market_name']} · {m['city']}</p><p>{m['description']}</p><p>{m['location_note'] or ''}</p><p><a class='btn whatsapp' href='/m/{slug}/contact?source=main'>Écrire sur WhatsApp</a> <a class='btn' href='/m/{slug}/qr'>QR code</a> <a class='btn' href='/m/{slug}/share'>Partager</a></p></section><h2>Produits / services</h2><section class='products'>{prod}</section>"
    return html_page(m['business_name'], body)

@app.get("/m/{slug}/contact")
def contact(request: Request, slug: str, source: str = "main", product_id: Optional[int] = None):
    m = get_merchant(slug); track(request, m['id'], 'whatsapp_click', source)
    message = f"Bonjour, j'ai vu votre fiche Rank Device ({m['business_name']}). Je suis intéressé par vos produits. Pouvez-vous m'envoyer plus d'informations ?"
    return RedirectResponse(f"https://wa.me/{clean_phone(m['whatsapp_number'])}?text={quote(message)}", status_code=302)

@app.get("/m/{slug}/share")
def share(request: Request, slug: str):
    m = get_merchant(slug); track(request, m['id'], 'share_click', 'share')
    return PlainTextResponse(public_url(slug))

@app.get("/m/{slug}/qr", response_class=HTMLResponse)
def qr_page(slug: str):
    m = get_merchant(slug)
    return html_page("QR", f"<section class='card'><h1>QR code</h1><p>{m['business_name']}</p><img class='qr' src='/m/{slug}/qr.png'><p>{public_url(slug)}</p><p><a class='btn primary' download href='/m/{slug}/qr.png'>Télécharger PNG</a> <a class='btn' href='/m/{slug}/poster'>Affiche imprimable</a></p></section>")

@app.get("/m/{slug}/qr.png")
def qr_png(request: Request, slug: str):
    m = get_merchant(slug); track(request, m['id'], 'qr_open', 'qr')
    img = qrcode.make(public_url(slug)); buf = io.BytesIO(); img.save(buf, format='PNG'); buf.seek(0)
    return StreamingResponse(buf, media_type='image/png')

@app.get("/m/{slug}/poster", response_class=HTMLResponse)
def poster(slug: str):
    m = get_merchant(slug)
    body = f"<section class='poster'><p>Rank Device</p><h1>{m['business_name']}</h1><h2>{m['category']}</h2><p>{m['market_name']} · {m['city']}</p><img src='/m/{slug}/qr.png'><p>Scannez pour voir les produits et écrire sur WhatsApp</p><p>{public_url(slug)}</p></section><p><button class='btn primary' onclick='print()'>Imprimer</button></p>"
    return html_page("Affiche", body)

@app.get("/api/merchants")
def api_merchants():
    rows = db().execute("select slug,business_name,category,description,country,city,market_name,updated_at from merchants where status='active'").fetchall()
    return [dict(r) | {"url": public_url(r['slug'])} for r in rows]

@app.get("/robots.txt")
def robots():
    return PlainTextResponse(f"User-agent: *\nAllow: /\nSitemap: {PUBLIC_BASE_URL}/sitemap.xml\n")

@app.get("/sitemap.xml")
def sitemap():
    rows = db().execute("select slug,updated_at from merchants where status='active'").fetchall()
    urls = ''.join(f"<url><loc>{PUBLIC_BASE_URL}/m/{r['slug']}</loc><lastmod>{r['updated_at']}</lastmod></url>" for r in rows)
    return Response(f"<?xml version='1.0' encoding='UTF-8'?><urlset xmlns='http://www.sitemaps.org/schemas/sitemap/0.9'><url><loc>{PUBLIC_BASE_URL}/</loc></url><url><loc>{PUBLIC_BASE_URL}/directory</loc></url>{urls}</urlset>", media_type="application/xml")

@app.get("/admin/export/{kind}.csv")
def export_csv(request: Request, kind: str):
    if not require_admin(request): return admin_redirect()
    table = 'merchants' if kind == 'merchants' else 'tracking_events'
    rows = db().execute(f"select * from {table}").fetchall()
    out = io.StringIO(); writer = csv.writer(out)
    if rows:
        writer.writerow(rows[0].keys())
        for r in rows: writer.writerow([r[k] for k in r.keys()])
    return Response(out.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={kind}.csv"})
