"""
Визуализация реляционной модели данных «Земельные участки».

Эквивалент документо-ориентированной MongoDB-модели в 3NF.
Запуск: python docs/relational_model.py
Результат: docs/relational_model.png
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# ── Определение таблиц ──────────────────────────────────────────────────
# (table_name, [(col, type, constraint), ...])
TABLES = [
    ("users", [
        ("id",            "SERIAL",       "PK"),
        ("username",      "VARCHAR(50)",  "UQ NOT NULL"),
        ("password_hash", "CHAR(128)",    "NOT NULL"),
        ("salt",          "CHAR(128)",    "NOT NULL"),
        ("role",          "VARCHAR(10)",  "NOT NULL  DEFAULT 'user'"),
        ("created_at",    "TIMESTAMPTZ",  "DEFAULT now()"),
    ]),
    ("plots", [
        ("id",              "SERIAL",        "PK"),
        ("owner_id",        "INT",           "FK → users.id"),
        ("avito_id",        "BIGINT",        "UQ"),
        ("title",           "VARCHAR(100)",  "NOT NULL"),
        ("description",     "TEXT",          ""),
        ("price",           "NUMERIC(12,2)", ""),
        ("area_sotki",      "NUMERIC(8,2)",  ""),
        ("price_per_sotka", "NUMERIC(12,2)", ""),
        ("location",        "VARCHAR(50)",   ""),
        ("address",         "VARCHAR(250)",  ""),
        ("geo_ref",         "VARCHAR(150)",  ""),
        ("lat",             "DOUBLE PREC.",  ""),
        ("lon",             "DOUBLE PREC.",  ""),
        ("geo_location",    "GEOGRAPHY(Pt)", ""),
        ("url",             "VARCHAR(200)",  ""),
        ("thumbnail",       "VARCHAR(300)",  ""),
        ("images_count",    "INT",           ""),
        ("was_lowered",     "BOOLEAN",       "DEFAULT false"),
        ("feature_score",   "DOUBLE PREC.",  ""),
        ("features_text",   "VARCHAR(500)",  ""),
        ("infra_score",     "DOUBLE PREC.",  ""),
        ("negative_score",  "DOUBLE PREC.",  ""),
        ("total_score",     "DOUBLE PREC.",  ""),
        ("created_at",      "TIMESTAMPTZ",   "DEFAULT now()"),
        ("updated_at",      "TIMESTAMPTZ",   ""),
    ]),
    ("plot_embeddings", [
        ("plot_id",   "INT",          "PK, FK → plots.id"),
        ("embedding", "VECTOR(384)",  "NOT NULL"),
    ]),
    ("plot_features", [
        ("plot_id",           "INT",         "PK, FK → plots.id"),
        ("has_gas",           "DOUBLE PREC.",""),
        ("has_electricity",   "DOUBLE PREC.",""),
        ("has_water",         "DOUBLE PREC.",""),
        ("has_sewage",        "DOUBLE PREC.",""),
        ("has_house",         "DOUBLE PREC.",""),
        ("is_izhs",           "DOUBLE PREC.",""),
        ("is_snt",            "DOUBLE PREC.",""),
        ("is_quiet",          "DOUBLE PREC.",""),
        ("has_forest",        "DOUBLE PREC.",""),
        ("near_river",        "DOUBLE PREC.",""),
        ("has_road",          "DOUBLE PREC.",""),
        ("has_fence",         "DOUBLE PREC.",""),
        ("flat_terrain",      "DOUBLE PREC.",""),
        ("has_communications","DOUBLE PREC.",""),
        ("documents_ready",   "DOUBLE PREC.",""),
    ]),
    ("plot_distances", [
        ("plot_id",              "INT",         "PK, FK → plots.id"),
        ("nearest_metro_id",     "INT",         "FK → metro_stations.id"),
        ("nearest_metro_km",     "DOUBLE PREC.",""),
        ("nearest_hospital_id",  "INT",         "FK → hospitals.id"),
        ("nearest_hospital_km",  "DOUBLE PREC.",""),
        ("nearest_school_id",    "INT",         "FK → schools.id"),
        ("nearest_school_km",    "DOUBLE PREC.",""),
        ("nearest_kinder_id",    "INT",         "FK → kindergartens.id"),
        ("nearest_kinder_km",    "DOUBLE PREC.",""),
        ("nearest_store_id",     "INT",         "FK → stores.id"),
        ("nearest_store_km",     "DOUBLE PREC.",""),
        ("nearest_pickup_id",    "INT",         "FK → pickup_points.id"),
        ("nearest_pickup_km",    "DOUBLE PREC.",""),
        ("nearest_bus_id",       "INT",         "FK → bus_stops.id"),
        ("nearest_bus_km",       "DOUBLE PREC.",""),
        ("nearest_negative_id",  "INT",         "FK → negative_objects.id"),
        ("nearest_negative_km",  "DOUBLE PREC.",""),
    ]),
    ("metro_stations", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("hospitals", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("schools", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("kindergartens", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("stores", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("pickup_points", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("bus_stops", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
    ("negative_objects", [
        ("id",   "SERIAL",         "PK"),
        ("name", "VARCHAR(80)",    "NOT NULL"),
        ("type", "VARCHAR(20)",    "NOT NULL"),
        ("geom", "GEOGRAPHY(Pt)",  "NOT NULL"),
    ]),
]

# ── Позиции таблиц на холсте ────────────────────────────────────────────
POSITIONS = {
    "users":            (0.5,  9.0),
    "plots":            (5.5,  8.0),
    "plot_embeddings":  (11.0, 11.0),
    "plot_features":    (11.0, 7.5),
    "plot_distances":   (11.0, 3.0),
    "metro_stations":   (0.0, 5.5),
    "hospitals":        (2.5, 5.5),
    "schools":          (5.0, 5.5),
    "kindergartens":    (7.5, 5.5),
    "stores":           (0.0, 2.5),
    "pickup_points":    (2.5, 2.5),
    "bus_stops":        (5.0, 2.5),
    "negative_objects": (7.5, 2.5),
}

# ── Связи (from_table, to_table, label, style) ──────────────────────────
RELATIONS = [
    ("plots", "users",            "owner_id",          "solid"),
    ("plot_embeddings", "plots",  "plot_id",           "solid"),
    ("plot_features", "plots",    "plot_id",           "solid"),
    ("plot_distances", "plots",   "plot_id",           "solid"),
    ("plot_distances", "metro_stations",   "nearest_metro_id",    "dashed"),
    ("plot_distances", "hospitals",        "nearest_hospital_id", "dashed"),
    ("plot_distances", "schools",          "nearest_school_id",   "dashed"),
    ("plot_distances", "kindergartens",    "nearest_kinder_id",   "dashed"),
    ("plot_distances", "stores",           "nearest_store_id",    "dashed"),
    ("plot_distances", "pickup_points",    "nearest_pickup_id",   "dashed"),
    ("plot_distances", "bus_stops",        "nearest_bus_id",      "dashed"),
    ("plot_distances", "negative_objects", "nearest_negative_id", "dashed"),
]

# ── Цвета ────────────────────────────────────────────────────────────────
COLORS = {
    "users":  "#A8D8EA",
    "plots":  "#FCBAD3",
    "plot_embeddings": "#FFE3E3",
    "plot_features":   "#FFE3E3",
    "plot_distances":  "#FFE3E3",
    "metro_stations": "#C3FDB8", "hospitals": "#C3FDB8",
    "schools": "#C3FDB8", "kindergartens": "#C3FDB8",
    "stores": "#C3FDB8", "pickup_points": "#C3FDB8",
    "bus_stops": "#C3FDB8",
    "negative_objects": "#FFD6A5",
}


def draw_table(ax, name, columns, x, y, col_w=3.8, row_h=0.28):
    """Рисует одну таблицу (прямоугольники + текст)."""
    header_h = 0.38
    total_h = header_h + len(columns) * row_h
    color = COLORS.get(name, "#EEEEEE")

    # Header
    ax.add_patch(mpatches.FancyBboxPatch(
        (x, y - header_h), col_w, header_h,
        boxstyle="round,pad=0.05", fc=color, ec="black", lw=1.2))
    ax.text(x + col_w / 2, y - header_h / 2, name,
            ha="center", va="center", fontsize=7.5, fontweight="bold", family="monospace")

    # Rows
    for i, (col, dtype, constr) in enumerate(columns):
        ry = y - header_h - (i + 1) * row_h
        ax.add_patch(mpatches.Rectangle(
            (x, ry), col_w, row_h, fc="white", ec="#BBBBBB", lw=0.5))
        prefix = ""
        if "PK" in constr:
            prefix = "[PK] "
        elif "FK" in constr:
            prefix = "[FK] "
        label = f"{prefix}{col}  {dtype}"
        ax.text(x + 0.08, ry + row_h / 2, label,
                ha="left", va="center", fontsize=5.5, family="monospace",
                color="#333333")

    return (x, y, x + col_w, y - total_h)


def draw_relation(ax, tbl_boxes, frm, to, label, style):
    """Рисует стрелку между двумя таблиц."""
    bx1 = tbl_boxes[frm]
    bx2 = tbl_boxes[to]
    cx1 = (bx1[0] + bx1[2]) / 2
    cy1 = (bx1[1] + bx1[3]) / 2
    cx2 = (bx2[0] + bx2[2]) / 2
    cy2 = (bx2[1] + bx2[3]) / 2

    # Clamp to box edges
    def edge_point(cx, cy, bx, toward_x, toward_y):
        dx = toward_x - cx
        dy = toward_y - cy
        if abs(dx) < 1e-9 and abs(dy) < 1e-9:
            return cx, cy
        w2 = (bx[2] - bx[0]) / 2
        h2 = (bx[1] - bx[3]) / 2
        sx = w2 / abs(dx) if abs(dx) > 1e-9 else 1e9
        sy = h2 / abs(dy) if abs(dy) > 1e-9 else 1e9
        s = min(sx, sy)
        return cx + dx * s, cy + dy * s

    x1, y1 = edge_point(cx1, cy1, bx1, cx2, cy2)
    x2, y2 = edge_point(cx2, cy2, bx2, cx1, cy1)

    ls = "--" if style == "dashed" else "-"
    color = "#888888" if style == "dashed" else "#444444"
    ax.annotate("",
                xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color=color,
                                lw=0.8, linestyle=ls))


def main():
    fig, ax = plt.subplots(figsize=(18, 14))
    ax.set_xlim(-1.5, 16.5)
    ax.set_ylim(0.5, 13)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.patch.set_facecolor("white")

    ax.text(8.0, 12.7,
            "Реляционная модель «Земельные участки» (PostgreSQL + PostGIS, 3NF)",
            ha="center", va="center", fontsize=13, fontweight="bold")

    # Draw tables
    tbl_boxes = {}
    for name, cols in TABLES:
        x, y = POSITIONS[name]
        box = draw_table(ax, name, cols, x, y)
        tbl_boxes[name] = box

    # Draw relations
    for frm, to, label, style in RELATIONS:
        draw_relation(ax, tbl_boxes, frm, to, label, style)

    # Legend
    legend_items = [
        mpatches.Patch(fc="#FCBAD3", ec="black", label="Основная (plots + дочерние)"),
        mpatches.Patch(fc="#A8D8EA", ec="black", label="Пользователи"),
        mpatches.Patch(fc="#C3FDB8", ec="black", label="Инфраструктура (7 таблиц)"),
        mpatches.Patch(fc="#FFD6A5", ec="black", label="Негативные объекты"),
    ]
    ax.legend(handles=legend_items, loc="lower right", fontsize=8,
              framealpha=0.9, edgecolor="#CCCCCC")

    out = "docs/relational_model.png"
    fig.savefig(out, dpi=180, bbox_inches="tight", pad_inches=0.3)
    print(f"Saved → {out}")
    plt.close(fig)


if __name__ == "__main__":
    main()
