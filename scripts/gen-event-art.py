#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""《三体纪元》v1.3 随机事件插图批量生成器 —— 工业画册 / 版画线稿

风格契约（docs/EXPANSION_V3.md §5）：
  米白纸底(#F4F1EA) + 墨黑线稿(#111111) + 极少量信号黄(#FDFD1F)，16:9 1600x900。
  每张图由事件 id 的 sha256 决定随机种子，因此构图唯一且可复现；不含任何第三方素材。

用法：
  python scripts/gen-event-art.py                     # 解析 src/events/definitions.ts，只补缺失的 <id>.jpg
  python scripts/gen-event-art.py --force             # 全部重绘
  python scripts/gen-event-art.py --only env_red_dawn,pol_hero_statue
  python scripts/gen-event-art.py --ids a,b,c         # 不读定义文件，直接生成这些 id（用于事件内容尚未落盘时）
  python scripts/gen-event-art.py --manifest-only     # 只重建 public/art-manifest-v3.json
  python scripts/gen-event-art.py --contact-sheet     # 额外输出 public/events/_contact-sheet.jpg 预览拼版
  python scripts/gen-event-art.py --limit 6           # 只生成前 N 张（调试用）

产物：
  public/events/<id>.jpg             事件插图（1600x900）
  public/art-manifest-v3.json        资产清单（打印包 + 事件插图 + 即梦 hero）
"""
import argparse
import hashlib
import json
import math
import os
import random
import re
import sys
import time

try:
    from PIL import Image, ImageDraw, ImageChops, ImageFont
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：请使用项目内置 Python（load_workspace_dependencies 提供的 python.exe）")

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

W, H = 1600, 900
SS = 2
PAPER = (244, 241, 234)
INK = (17, 17, 17)
YELLOW = (253, 253, 31)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFS_DEFAULT = os.path.join(ROOT, "src", "events", "definitions.ts")
OUT_DEFAULT = os.path.join(ROOT, "public", "events")
MANIFEST_DEFAULT = os.path.join(ROOT, "public", "art-manifest-v3.json")
PRINT_DIR = os.path.join(ROOT, "public", "print")
HERO_DIR = os.path.join(ROOT, "public", "images", "v13")

ID_RE = re.compile(r"""id\s*:\s*["']([a-zA-Z][a-zA-Z0-9_]{2,})["']""")
EVENT_ID_RE = re.compile(r"^(env|soc|pol|sci|ind|spc|mys|haz|mil|econ|tech|cul|exp)_[a-z0-9_]+$")


# ----------------------------------------------------------------------------
# 基础工具
# ----------------------------------------------------------------------------
def mix(c1, c2, t):
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3))


def seed_for(eid):
    return int(hashlib.sha256(eid.encode("utf-8")).hexdigest()[:16], 16)


class Art(object):
    """在 1600x900 设计坐标工作、内部 2x 超采样后缩放的线稿画布。"""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.img = Image.new("RGB", (W * SS, H * SS), PAPER)
        self.d = ImageDraw.Draw(self.img)

    # -- 颜色 --------------------------------------------------------------
    def ink(self, a=1.0):
        return mix(PAPER, INK, a)

    def yel(self, a=1.0):
        return mix(PAPER, YELLOW, a)

    # -- 基本图元 ----------------------------------------------------------
    def _pts(self, pts):
        return [(x * SS, y * SS) for x, y in pts]

    def _w(self, w):
        return max(1, int(round(w * SS * 1.18)))

    def line(self, pts, w=1.3, a=1.0, color=None):
        col = color if color is not None else self.ink(a)
        self.d.line(self._pts(pts), fill=col, width=self._w(w), joint="curve")

    def polyout(self, pts, w=1.3, a=1.0, close=True, color=None):
        p = self._pts(pts)
        if close:
            p = p + [p[0]]
        col = color if color is not None else self.ink(a)
        self.d.line(p, fill=col, width=self._w(w), joint="curve")

    def fill(self, pts, a=1.0, color=None):
        col = color if color is not None else self.ink(a)
        self.d.polygon(self._pts(pts), fill=col)

    def yfill(self, pts, a=1.0):
        self.d.polygon(self._pts(pts), fill=self.yel(a))

    def rect(self, x0, y0, x1, y1, w=1.2, a=0.9):
        self.d.rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], outline=self.ink(a), width=self._w(w))

    def rectfill(self, x0, y0, x1, y1, a=0.9):
        self.d.rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=self.ink(a))

    def circle(self, cx, cy, r, w=1.3, a=0.9):
        self.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], outline=self.ink(a), width=self._w(w))

    def disk(self, cx, cy, r, a=1.0):
        self.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=self.ink(a))

    def ydisk(self, cx, cy, r, a=1.0):
        self.d.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=self.yel(a))

    def ellipse(self, cx, cy, rx, ry, w=1.2, a=0.85):
        self.d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], outline=self.ink(a), width=self._w(w))

    def arc(self, cx, cy, r, a0, a1, w=1.2, a=0.85):
        box = [(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS]
        self.d.arc(box, start=a0, end=a1, fill=self.ink(a), width=self._w(w))

    def cross(self, cx, cy, size=6.0, a=0.6, w=1.0):
        self.line([(cx - size, cy), (cx + size, cy)], w, a)
        self.line([(cx, cy - size), (cx, cy + size)], w, a)

    def crossesquare(self, cx, cy, size=5.0, a=0.7, w=1.0):
        self.rect(cx - size, cy - size, cx + size, cy + size, w, a)
        self.cross(cx, cy, size * 1.7, a, w)

    def dashed(self, pts, dash=10.0, gap=7.0, w=1.1, a=0.7):
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[i + 1]
            seg = math.hypot(x1 - x0, y1 - y0)
            if seg < 1e-3:
                continue
            ux, uy = (x1 - x0) / seg, (y1 - y0) / seg
            pos = 0.0
            while pos < seg:
                end = min(seg, pos + dash)
                self.line([(x0 + ux * pos, y0 + uy * pos), (x0 + ux * end, y0 + uy * end)], w, a)
                pos = end + gap

    def dashed_circle(self, cx, cy, r, dash=14.0, gap=10.0, w=1.0, a=0.55):
        circ = math.pi * 2 * r
        n = max(6, int(circ / (dash + gap)))
        step = 360.0 / n
        for i in range(n):
            a0 = i * step
            a1 = a0 + 360.0 * dash / (dash + gap) / 1.0 * (1.0 / 1.0)
            self.arc(cx, cy, r, a0, min(a0 + step * dash / (dash + gap), a1), w, a)

    def ruler(self, x0, x1, y, step=18.0, long_every=5, h_short=4.0, h_long=8.0, w=0.8, a=0.45):
        n = int(max(0, (x1 - x0)) // step)
        for i in range(n + 1):
            x = x0 + i * step
            h = h_long if i % long_every == 0 else h_short
            self.line([(x, y), (x, y - h)], w, a)

    def grid(self, x0, y0, x1, y1, step=80.0, a=0.06, w=0.6):
        """构建辅助线（只取稀疏虚线，避免坐标纸观感）。"""
        x = x0
        while x <= x1:
            self.dashed([(x, y0), (x, y1)], 5.0, 26.0, w, a * 0.8)
            x += step * 2.0
        y = y0
        while y <= y1:
            self.dashed([(x0, y), (x1, y)], 5.0, 26.0, w, a * 0.8)
            y += step * 2.0

    def stars(self, count, x0, y0, x1, y1, a_min=0.25, a_max=0.85):
        count = int(count * 1.5)
        for _ in range(count):
            x = self.rng.uniform(x0, x1)
            y = self.rng.uniform(y0, y1)
            a = self.rng.uniform(a_min, a_max)
            r = self.rng.choice([0.55, 0.7, 0.9, 1.2])
            if self.rng.random() < 0.09:
                self.cross(x, y, self.rng.uniform(2.0, 5.0), a, 0.7)
            else:
                self.disk(x, y, r, a)

    # -- 填充类（遮罩 + 粘贴，保证不溢出多边形） ---------------------------
    def _mask_layer(self, pts):
        xs = [x * SS for x, y in pts]
        ys = [y * SS for x, y in pts]
        x0 = max(0, int(math.floor(min(xs))))
        y0 = max(0, int(math.floor(min(ys))))
        x1 = min(W * SS, int(math.ceil(max(xs))) + 1)
        y1 = min(H * SS, int(math.ceil(max(ys))) + 1)
        bw, bh = x1 - x0, y1 - y0
        if bw < 2 or bh < 2:
            return None
        mask = Image.new("L", (bw, bh), 0)
        ImageDraw.Draw(mask).polygon([(x * SS - x0, y * SS - y0) for x, y in pts], fill=255)
        return x0, y0, bw, bh, mask

    def hatch(self, pts, spacing=7.0, angle=45.0, w=0.9, a=0.45, cross=False, yellow=False):
        if len(pts) < 3:
            return
        ml = self._mask_layer(pts)
        if ml is None:
            return
        x0, y0, bw, bh, mask = ml
        layer = Image.new("L", (bw, bh), 0)
        ld = ImageDraw.Draw(layer)
        cx, cy = x0 + bw / 2.0, y0 + bh / 2.0
        diag = math.hypot(bw, bh) + 8.0
        angles = [angle, angle + 90.0] if cross else [angle]
        for ang_deg in angles:
            ang = math.radians(ang_deg)
            dx, dy = math.cos(ang), math.sin(ang)
            nx, ny = -dy, dx
            corners = [(x0, y0), (x0 + bw, y0), (x0, y0 + bh), (x0 + bw, y0 + bh)]
            proj = [(px - cx) * nx + (py - cy) * ny for px, py in corners]
            nmin, nmax = min(proj), max(proj)
            sp = max(2.0, spacing * SS)
            n = math.floor(nmin / sp) * sp
            while n <= nmax:
                px, py = cx + n * nx, cy + n * ny
                ld.line([(px - diag * dx, py - diag * dy), (px + diag * dx, py + diag * dy)],
                        fill=255, width=self._w(w))
                n += sp
        alpha = ImageChops.multiply(layer, mask)
        a = min(0.88, a * 1.28)
        if a < 0.999:
            alpha = alpha.point(lambda v: int(v * a))
        col = YELLOW if yellow else INK
        self.img.paste(Image.new("RGB", (bw, bh), col), (x0, y0), alpha)

    def stipple(self, pts, count=320, rmin=0.4, rmax=1.15, a=0.5):
        ml = self._mask_layer(pts)
        if ml is None:
            return
        x0, y0, bw, bh, mask = ml
        layer = Image.new("L", (bw, bh), 0)
        ld = ImageDraw.Draw(layer)
        tries = 0
        placed = 0
        while placed < count and tries < count * 6:
            tries += 1
            px = self.rng.uniform(0, bw)
            py = self.rng.uniform(0, bh)
            if mask.getpixel((int(px), int(py))) > 0:
                r = self.rng.uniform(rmin, rmax) * SS
                ld.ellipse([px - r, py - r, px + r, py + r], fill=255)
                placed += 1
        alpha = ImageChops.multiply(layer, mask)
        if a < 0.999:
            alpha = alpha.point(lambda v: int(v * a))
        self.img.paste(Image.new("RGB", (bw, bh), INK), (x0, y0), alpha)

    # -- 完成 --------------------------------------------------------------
    def finish(self, path):
        img = self.img.resize((W, H), Image.LANCZOS)
        img = apply_paper(img, self.rng)
        img = polish(img)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.convert("RGB").save(path, "JPEG", quality=89, optimize=True, progressive=True)
        return img


# ----------------------------------------------------------------------------
# 纸面 / 版式
# ----------------------------------------------------------------------------
def polish(img):
    """照片级微调：提升对比与锐度，让线稿在缩略图尺度下也立得住。"""
    from PIL import ImageEnhance
    img = ImageEnhance.Contrast(img).enhance(1.22)
    img = ImageEnhance.Sharpness(img).enhance(1.12)
    return img


def apply_paper(img, rng):
    """叠印刷纸纹：细颗粒为主，极轻的低频斑驳，不出现大片脏斑。"""
    if np is None:
        return img
    arr = np.asarray(img).astype(np.float32)
    nr = np.random.default_rng(rng.randint(0, 2 ** 31 - 1))
    fine = nr.normal(0.0, 1.6, (H, W))
    small = nr.normal(0.0, 1.0, (H // 6 + 2, W // 6 + 2))
    low = np.asarray(Image.fromarray(small.astype(np.float32), mode="F").resize((W, H), Image.BICUBIC))
    tex = 255.0 + fine + low * 0.9
    arr = arr * (tex[..., None] / 255.0)
    yy, xx = np.mgrid[0:H, 0:W]
    edge = 1.0 - 0.022 * (((xx - W / 2.0) / (W / 2.0)) ** 8 + ((yy - H / 2.0) / (H / 2.0)) ** 8)
    arr = arr * edge[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")



def plate_frame(a, seed):
    """统一的画册版框：细框线、裁切标、刻度尺、套准标记、作品序号刻度。"""
    m = 34
    a.rect(m, m, W - m, H - m, 0.7, 0.15)
    for x, y, dx, dy in [(m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        a.line([(x + dx * 18, y), (x + dx * 4, y)], 0.9, 0.34)
        a.line([(x, y + dy * 18), (x, y + dy * 4)], 0.9, 0.34)
        a.cross(x, y, 2.6, 0.5, 0.8)
    a.ruler(m + 10, W - m - 10, m - 10, 26.0, 6, 3.0, 7.0, 0.7, 0.24)
    a.ruler(m + 10, W - m - 10, H - m + 10, 26.0, 6, 3.0, 7.0, 0.7, 0.24)
    # 左下：印刷序列码（几何，不写字）
    bx, by = m + 12, H - m - 16
    count = 2 + seed % 6
    for i in range(count):
        a.rectfill(bx + i * 7.0, by, bx + i * 7.0 + 4.0, by + 4.0, 0.20 + 0.09 * i)
    # 右下：信号黄小方块 + 上升刻度
    a.yfill([(W - m - 26, H - m - 20), (W - m - 18, H - m - 20), (W - m - 18, H - m - 12), (W - m - 26, H - m - 12)], 0.92)
    for i in range(3):
        a.line([(W - m - 12 - i * 5, H - m - 12), (W - m - 12 - i * 5, H - m - 12 - (3 + i * 2))], 0.9, 0.35)
    # 右上：微型方向标
    a.crossesquare(W - m - 20, m + 20, 3.2, 0.35, 0.8)


# ----------------------------------------------------------------------------
# 通用母题
# ----------------------------------------------------------------------------
def sky_base(a, horizon_y=600, stars=90, grid_a=0.045):
    # 只保留极少量构建弧线，避免"坐标纸"观感
    for i in range(2):
        r = a.rng.uniform(420, 900)
        a.arc(800, horizon_y + 30, r, 200 + a.rng.uniform(-14, 14), 340, 0.55, 0.055)
    for i in range(2):
        y = 90 + i * 120 + a.rng.uniform(-20, 20)
        a.dashed([(60, y), (W - 60, y)], 26, 22, 0.55, 0.05)
    a.stars(stars, 50, 50, W - 50, horizon_y - 20)

def horizon_line(a, y=600, alpha=0.75):
    a.line([(30, y), (W - 30, y)], 1.5, alpha)
    a.line([(30, y + 6), (W - 30, y + 6)], 0.7, alpha * 0.35)
    a.ruler(52, W - 52, y + 12, 18.0, 5, 3.0, 7.0, 0.7, alpha * 0.30)


def ground(a, horizon_y=600, spacing=9.0, alpha=0.30, angle=-48.0):
    a.hatch([(-20, horizon_y), (W + 20, horizon_y), (W + 20, H + 20), (-20, H + 20)],
            spacing=spacing * 1.45, angle=angle, w=0.9, a=alpha * 0.85)
    for i in range(5):
        y = horizon_y + 26 + i * 68 + a.rng.uniform(-14, 14)
        pts = []
        for k in range(10):
            pts.append((30 + k * (W - 60) / 9.0, y + a.rng.uniform(-7, 7)))
        a.line(pts, 0.7, 0.13)
    a.stipple([(40, horizon_y + 30), (W - 40, horizon_y + 30), (W - 40, H - 15), (40, H - 15)],
              260, 0.35, 0.85, 0.14)

def foreground(a, y=828, jag=26, alpha=0.82):
    """前景暗部（版画压角）：底部不规则暗块 + 纸色刻线高光，稳定构图。"""
    pts = [(-10, H + 10)]
    x = -10.0
    while x < W + 10:
        x += a.rng.uniform(60, 130)
        pts.append((min(x, W + 10), y - a.rng.uniform(0, jag)))
    pts.append((W + 10, H + 10))
    a.fill(pts, alpha)
    a.hatch(pts, spacing=6.0, angle=42, w=0.8, a=0.32, cross=True)
    for i in range(14):
        px = a.rng.uniform(30, W - 30)
        py = a.rng.uniform(y + 6, H - 20)
        a.line([(px, py), (px + a.rng.uniform(24, 70), py + a.rng.uniform(-6, 6))], 1.0, 0.30, color=PAPER)

def ridge(a, base_y=600, amp=130, layers=2, spacing=7.0):
    for li in range(layers):
        yb = base_y - li * 12
        pts = [(-10, yb)]
        x = -10.0
        while x < W + 10:
            x += a.rng.uniform(46, 118)
            peak = a.rng.uniform(0.05, 1.0) * amp * (1.0 - 0.26 * li)
            if a.rng.random() < 0.2:
                peak *= 1.4
            pts.append((min(x, W + 10), yb - peak))
        pts.append((W + 10, yb))
        poly = pts + [(W + 10, H + 20), (-10, H + 20)]
        a.hatch(poly, spacing=max(3.6, spacing - li * 0.6), angle=52, w=0.9, a=0.42 - li * 0.10)
        a.hatch(poly, spacing=max(5.0, spacing * 1.7), angle=-46, w=0.7, a=0.20 - li * 0.05)
        a.line(pts, 1.7 - li * 0.3, 0.78 - li * 0.16)
        # 山峰亮面留白：沿脊线下方扫出纸色高光
        for i in range(3):
            if len(pts) > 3:
                k = a.rng.randint(1, len(pts) - 3)
                px, py = pts[k]
                a.line([(px, py + 4), (px + a.rng.uniform(20, 60), py + a.rng.uniform(10, 26))], 1.2, 0.55, color=PAPER)

def sun_rays(a, cx, cy, r, n=30, r0=1.15, r1=1.9, w=0.8, alpha=0.45):
    for i in range(n):
        ang = 2 * math.pi * i / n + 0.11
        a.line([(cx + math.cos(ang) * r * r0, cy + math.sin(ang) * r * r0),
                (cx + math.cos(ang) * r * r1, cy + math.sin(ang) * r * r1)], w, alpha)


def sun(a, cx, cy, r, yellow=True, rays=True, alpha=0.95):
    """版画式太阳：白盘 + 双层轮廓 + 内部刻线阴影 + 短刻线射线。"""
    a.disk(cx, cy, r, 0.05)
    a.circle(cx, cy, r, 2.4, 0.92)
    a.circle(cx, cy, r * 0.88, 1.0, 0.40)
    # 下半部刻线阴影（版画明暗）
    shade = []
    for i in range(21):
        ang = math.pi * (0.02 + 0.96 * i / 20.0)
        shade.append((cx + math.cos(ang) * r * 0.93, cy + math.sin(ang) * r * 0.93))
    shade.append((cx - r * 0.93, cy + r * 0.1))
    shade.append((cx + r * 0.93, cy + r * 0.1))
    a.hatch(shade, spacing=max(3.0, r * 0.075), angle=24, w=0.7, a=0.30)
    a.hatch(shade, spacing=max(5.0, r * 0.16), angle=-38, w=0.6, a=0.16)
    if rays:
        n = 44
        for i in range(n):
            ang = 2 * math.pi * i / n
            r0 = r * (1.12 + 0.05 * ((i * 7) % 3))
            r1 = r * (1.32 + 0.26 * ((i * 5) % 4) / 3.0)
            a.line([(cx + math.cos(ang) * r0, cy + math.sin(ang) * r0),
                    (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1)], 1.0, 0.42)
    if yellow:
        a.yfill([(cx - 6, cy - 6), (cx + 6, cy - 6), (cx + 6, cy + 6), (cx - 6, cy + 6)], 0.95)


def annotations(a, seed):
    """档案图版标注：尺寸线、引线圆标、铅垂线、比例尺。不写字。"""
    rng = a.rng
    # 尺寸线
    for k in range(2):
        y = rng.uniform(690, 830)
        x0 = rng.uniform(80, 560)
        ln = rng.uniform(220, 420)
        a.line([(x0, y), (x0 + ln, y)], 0.8, 0.30)
        for xx in (x0, x0 + ln):
            a.line([(xx, y - 10), (xx, y + 10)], 0.9, 0.34)
            a.line([(xx, y), (xx + (18 if xx == x0 else -18), y - 6)], 0.8, 0.30)
            a.line([(xx, y), (xx + (18 if xx == x0 else -18), y + 6)], 0.8, 0.30)
    # 引线圆标
    for k in range(2):
        tx = rng.uniform(200, 1400)
        ty = rng.uniform(180, 520)
        ex = tx + rng.uniform(-150, 150)
        ey = ty + rng.uniform(60, 160)
        a.line([(tx, ty), (ex, ey)], 0.8, 0.32)
        a.line([(ex, ey), (ex + rng.choice([-1, 1]) * 46, ey)], 0.8, 0.32)
        a.circle(tx, ty, 9, 0.9, 0.45)
        a.cross(tx, ty, 3.5, 0.40, 0.7)
    # 铅垂线
    px = rng.uniform(300, 1300)
    a.dashed([(px, 140), (px, rng.uniform(620, 760))], 7, 6, 0.7, 0.22)
    a.cross(px, rng.uniform(620, 760), 5.0, 0.28, 0.8)
    # 比例尺
    sx, sy = 70, 846
    a.line([(sx, sy), (sx + 180, sy)], 1.0, 0.45)
    for i in range(5):
        a.line([(sx + i * 45, sy - 4), (sx + i * 45, sy + 4)], 0.9, 0.40)
    a.rectfill(sx, sy - 3, sx + 45, sy + 3, 0.35)
    a.rectfill(sx + 90, sy - 3, sx + 135, sy + 3, 0.35)

def beacon(a, x, y, size=8.0, rays=3):
    """信号黄小标记：全图唯一的强黄锚点。"""
    a.yfill([(x, y - size * 0.7), (x + size, y - size * 0.7), (x + size, y + size * 0.7), (x, y + size * 0.7)], 0.95)
    a.polyout([(x, y - size * 0.7), (x + size, y - size * 0.7), (x + size, y + size * 0.7), (x, y + size * 0.7)], 1.0, 0.75)
    for i in range(rays):
        ang = -0.5 + i * 0.5
        a.line([(x + size, y), (x + size + math.cos(ang) * size * 3.2, y + math.sin(ang) * size * 2.0)], 0.8, 0.35)

def person(a, x, y, h=62.0, alpha=0.92, cloak=False, arm="none", lantern=None):
    hd = h * 0.105
    head_y = y - h + hd
    if h < 46:
        # 远景小人：极简剪影
        a.disk(x, head_y, hd * 1.05, alpha)
        a.fill([(x - h * 0.10, head_y + hd), (x + h * 0.10, head_y + hd),
                (x + h * 0.13, y), (x - h * 0.13, y)], alpha * 0.9)
        return
    a.circle(x, head_y, hd, 1.6, alpha)
    a.hatch([(x - hd, head_y - hd), (x + hd, head_y - hd), (x + hd, head_y + hd), (x - hd, head_y + hd)],
            spacing=max(2.0, hd * 0.42), angle=64, w=0.4, a=0.35)
    sh_y = head_y + hd * 1.5
    hip_y = y - h * 0.40
    if cloak:
        poly = [(x - h * 0.115, sh_y), (x + h * 0.115, sh_y), (x + h * 0.30, y), (x - h * 0.30, y)]
        a.fill(poly, alpha * 0.94)
        a.hatch(poly, spacing=max(2.6, h * 0.052), angle=76, w=0.7, a=0.30, cross=False)
        for i in range(3):
            a.line([(x - h * 0.22 + i * h * 0.09, y - h * 0.06), (x - h * 0.10 + i * h * 0.07, hip_y + h * 0.04)],
                   0.9, 0.30, color=PAPER)
    else:
        a.line([(x - h * 0.085, sh_y), (x - h * 0.055, hip_y)], 1.5, alpha)
        a.line([(x + h * 0.085, sh_y), (x + h * 0.055, hip_y)], 1.5, alpha)
        a.line([(x - h * 0.085, sh_y), (x + h * 0.085, sh_y)], 1.3, alpha)
        a.hatch([(x - h * 0.075, sh_y), (x + h * 0.075, sh_y), (x + h * 0.045, hip_y), (x - h * 0.045, hip_y)],
                 spacing=max(2.2, h * 0.045), angle=68, w=0.4, a=0.34)
        a.line([(x - h * 0.045, hip_y), (x - h * 0.115, y)], 1.6, alpha)
        a.line([(x + h * 0.045, hip_y), (x + h * 0.115, y)], 1.6, alpha)
        a.line([(x - h * 0.02, hip_y), (x - h * 0.05, y)], 0.8, alpha * 0.6)
        a.line([(x + h * 0.02, hip_y), (x + h * 0.05, y)], 0.8, alpha * 0.6)
        if arm == "raise":
            a.line([(x - h * 0.08, sh_y), (x - h * 0.24, sh_y - h * 0.22)], 1.4, alpha)
            a.line([(x + h * 0.08, sh_y), (x + h * 0.26, sh_y - h * 0.46)], 1.4, alpha)
        elif arm == "point":
            a.line([(x + h * 0.08, sh_y), (x + h * 0.42, sh_y - h * 0.02)], 1.4, alpha)
            a.line([(x - h * 0.08, sh_y), (x - h * 0.19, sh_y + h * 0.20)], 1.4, alpha)
        else:
            a.line([(x - h * 0.08, sh_y), (x - h * 0.17, sh_y + h * 0.22)], 1.2, alpha)
            a.line([(x + h * 0.08, sh_y), (x + h * 0.17, sh_y + h * 0.22)], 1.2, alpha)
    if lantern is not None:
        ly = y - h * 0.62
        a.yfill([(x + h * 0.16, ly), (x + h * 0.24, ly), (x + h * 0.23, ly + h * 0.10), (x + h * 0.17, ly + h * 0.10)], lantern)
        for i in range(3):
            ang = -0.45 + i * 0.45
            a.line([(x + h * 0.20, ly + h * 0.05), (x + h * 0.20 + math.cos(ang) * h * 0.16, ly + h * 0.05 + math.sin(ang) * h * 0.16)], 0.7, 0.30)

def crowd(a, n, x0, x1, y, hmin=40.0, hmax=78.0, alpha=0.85, cloak=False):
    for i in range(n):
        t = (i + 0.5) / max(1, n)
        x = x0 + (x1 - x0) * t + a.rng.uniform(-8, 8)
        h = a.rng.uniform(hmin, hmax)
        person(a, x, y + a.rng.uniform(-5, 5), h, alpha * a.rng.uniform(0.75, 1.05), cloak=cloak)


def dish(a, cx, cy, r, tilt=20.0, alpha=0.92):
    tr = math.radians(tilt)

    def R(px, py):
        return (cx + px * math.cos(tr) - py * math.sin(tr), cy + px * math.sin(tr) + py * math.cos(tr))

    rim = []
    n = 30
    for i in range(n + 1):
        t = -1.0 + 2.0 * i / n
        rim.append(R(t * r, t * t * r * 0.40))
    a.line(rim, 1.9, alpha)
    # 背架 / 内环
    a.line([R(-r, 0.40 * r), R(-r * 0.55, 0.40 * r * 0.30), R(0, 0.0), R(r * 0.55, 0.40 * r * 0.30), R(r, 0.40 * r)], 0.7, alpha * 0.30)
    for i in range(1, n, 3):
        t = -1.0 + 2.0 * i / n
        a.line([R(t * r, t * t * r * 0.40), R(0, -r * 0.42)], 0.55, alpha * 0.32)
    # 馈源
    fx, fy = R(0, -r * 0.52)
    a.circle(fx, fy, max(3.0, r * 0.055), 1.2, alpha)
    a.disk(fx, fy, max(1.6, r * 0.022), 0.9)
    for t in (-0.85, 0.0, 0.85):
        a.line([R(t * r, t * t * r * 0.40), (fx, fy)], 0.8, alpha * 0.65)
    # 支柱与基座
    vx, vy = R(0, 0)
    for t in (-0.7, 0.7):
        a.line([R(t * r, t * t * r * 0.40), (vx, vy + r * 0.55)], 1.1, alpha * 0.7)
    a.line([(vx, vy), (vx, vy + r * 0.58)], 1.4, alpha * 0.8)
    a.hatch([(vx - r * 0.30, vy + r * 0.58), (vx + r * 0.30, vy + r * 0.58),
             (vx + r * 0.20, vy + r * 0.80), (vx - r * 0.20, vy + r * 0.80)], spacing=5.0, angle=60, w=0.7, a=0.40)
    a.polyout([(vx - r * 0.30, vy + r * 0.58), (vx + r * 0.30, vy + r * 0.58),
               (vx + r * 0.20, vy + r * 0.80), (vx - r * 0.20, vy + r * 0.80)], 1.2, alpha * 0.8)
    return (fx, fy)


def signal_arcs(a, cx, cy, count=4, r0=40.0, step=42.0, a0=200, a1=340, alpha=0.5):
    for i in range(count):
        a.arc(cx, cy, r0 + i * step, a0, a1, 1.0, alpha * (1.0 - 0.16 * i))


def gear(a, cx, cy, r, teeth=16, alpha=0.85):
    a.circle(cx, cy, r, 1.7, alpha)
    a.circle(cx, cy, r * 0.72, 0.9, alpha * 0.7)
    a.circle(cx, cy, r * 0.22, 1.2, alpha)
    for i in range(teeth):
        ang = 2 * math.pi * i / teeth
        x0 = cx + math.cos(ang) * r
        y0 = cy + math.sin(ang) * r
        x1 = cx + math.cos(ang) * (r + r * 0.13)
        y1 = cy + math.sin(ang) * (r + r * 0.13)
        a.line([(x0, y0), (x1, y1)], max(2.0, r * 0.07), alpha)
    for i in range(6):
        ang = 2 * math.pi * i / 6
        a.line([(cx + math.cos(ang) * r * 0.22, cy + math.sin(ang) * r * 0.22),
                (cx + math.cos(ang) * r * 0.72, cy + math.sin(ang) * r * 0.72)], 0.8, alpha * 0.55)


def chimney(a, x, base_y, w, h):
    a.polyout([(x - w / 2, base_y), (x - w * 0.34, base_y - h), (x + w * 0.34, base_y - h), (x + w / 2, base_y)], 1.5, 0.88)
    a.hatch([(x - w / 2, base_y), (x - w * 0.34, base_y - h), (x + w * 0.34, base_y - h), (x + w / 2, base_y)], spacing=5.5, angle=68, w=0.6, a=0.30)
    for i in range(5):
        yy = base_y - h * (0.18 + i * 0.17)
        a.line([(x - w * 0.45, yy), (x + w * 0.45, yy)], 0.7, 0.26)
    for i in range(4):
        a.arc(x + w * 0.2 + i * w * 0.30, base_y - h - w * 0.30 - i * w * 0.42, w * (0.5 + i * 0.22), 180, 360, 0.8, 0.30)


def perspective_floor(a, horizon_y, vp_x, vp_y, rows=7, spacing=95.0, alpha=0.18):
    for i in range(rows):
        y = horizon_y + 40 + i * spacing
        a.line([(60, y), (W - 60, y)], 0.7, alpha)
    for i in range(-6, 7):
        a.line([(vp_x + i * 110, horizon_y), (vp_x + i * 380, H - 30)], 0.6, alpha * 0.7)


def shelves(a, x0, y0, x1, y1, cols=5, rows=6):
    w = (x1 - x0) / cols
    h = (y1 - y0) / rows
    for c in range(cols + 1):
        a.line([(x0 + c * w, y0), (x0 + c * w, y1)], 1.1, 0.55)
    for r in range(rows + 1):
        a.line([(x0, y0 + r * h), (x1, y0 + r * h)], 1.1, 0.55)
    for c in range(cols):
        for r in range(rows):
            bx = x0 + c * w + w * 0.12
            by = y0 + r * h + h * 0.30
            bw = w * 0.74
            bh = h * 0.54
            a.rect(bx, by, bx + bw, by + bh, 0.7, 0.35)
            a.line([(bx + bw * 0.18, by + bh * 0.30), (bx + bw * 0.82, by + bh * 0.30)], 0.6, 0.25)
            if a.rng.random() < 0.45:
                a.hatch([(bx, by), (bx + bw, by), (bx + bw, by + bh), (bx, by + bh)], spacing=3.4, angle=-40, w=0.5, a=0.20)


def paper_moon(a, cx, cy, r, cut=(30, -18, 0.92)):
    a.disk(cx, cy, r, 0.90)
    cutx, cuty, k = cut
    r2 = r * k
    a.d.ellipse([(cx + cutx - r2) * SS, (cy + cuty - r2) * SS, (cx + cutx + r2) * SS, (cy + cuty + r2) * SS], fill=PAPER)
    a.circle(cx, cy, r, 1.0, 0.42)


def telescope(a, x, y, length=320.0, ang=-24.0, alpha=0.92):
    ar = math.radians(ang)
    dx, dy = math.cos(ar), math.sin(ar)
    nx, ny = -dy, dx
    w0, w1 = 13.0, 7.0
    p1 = (x + dx * length, y + dy * length)
    q = [(x - nx * w0, y - ny * w0), (p1[0] - nx * w1, p1[1] - ny * w1),
         (p1[0] + nx * w1, p1[1] + ny * w1), (x + nx * w0, y + ny * w0)]
    a.polyout(q, 1.7, alpha)
    a.line([(x - nx * w0 * 0.45, y - ny * w0 * 0.45), (p1[0] - nx * w1 * 0.45, p1[1] - ny * w1 * 0.45)], 0.7, alpha * 0.35)
    a.circle(p1[0], p1[1], w1 * 0.9, 1.1, alpha)
    a.circle(x, y, w0 * 0.75, 1.0, alpha * 0.7)
    # 三脚架
    a.line([(x, y), (x - 90, y + 250)], 1.3, alpha * 0.8)
    a.line([(x, y), (x + 80, y + 254)], 1.3, alpha * 0.8)
    a.line([(x, y), (x + 6, y + 262)], 1.3, alpha * 0.8)
    for i in range(3):
        a.line([(x - 90 + i * 14, y + 236 - i * 6), (x - 60 + i * 14, y + 250 - i * 6)], 0.7, alpha * 0.4)
    # 配重
    a.line([(x - nx * w0, y - ny * w0), (x - dx * 60, y - dy * 60)], 1.0, alpha * 0.6)
    a.circle(x - dx * 66, y - dy * 66, 9, 1.0, alpha * 0.8)


def satellite(a, cx, cy, s=1.0, alpha=0.92):
    # 本体
    a.rect(cx - 26 * s, cy - 18 * s, cx + 26 * s, cy + 18 * s, 1.6, alpha)
    a.hatch([(cx - 26 * s, cy - 18 * s), (cx + 26 * s, cy - 18 * s), (cx + 26 * s, cy + 18 * s), (cx - 26 * s, cy + 18 * s)],
            spacing=4.0 * s, angle=55, w=0.5, a=0.28)
    # 太阳翼
    for sign in (-1, 1):
        x0 = cx + sign * (28 * s)
        x1 = cx + sign * (150 * s)
        a.rect(min(x0, x1), cy - 44 * s, max(x0, x1), cy - 2 * s, 1.3, alpha)
        a.rect(min(x0, x1), cy + 4 * s, max(x0, x1), cy + 44 * s, 1.3, alpha)
        for i in range(4):
            yy = cy - 44 * s + i * 11 * s
            a.line([(min(x0, x1), yy), (max(x0, x1), yy)], 0.55, alpha * 0.4)
            yy2 = cy + 4 * s + i * 11 * s
            a.line([(min(x0, x1), yy2), (max(x0, x1), yy2)], 0.55, alpha * 0.4)
    # 抛物面天线
    a.line([(cx, cy - 18 * s), (cx, cy - 78 * s)], 1.2, alpha)
    a.arc(cx, cy - 78 * s, 30 * s, 200, 340, 1.3, alpha)
    a.line([(cx - 30 * s, cy - 66 * s), (cx, cy - 34 * s)], 0.8, alpha * 0.5)
    a.line([(cx + 30 * s, cy - 66 * s), (cx, cy - 34 * s)], 0.8, alpha * 0.5)
    a.disk(cx, cy - 96 * s, 2.2 * s, alpha)


def generation_ship(a, cx, cy, length=900.0, alpha=0.92):
    half = length / 2.0
    r = 72.0
    a.polyout([(cx - half, cy - r * 0.72), (cx + half - 40, cy - r * 0.72), (cx + half, cy - r * 0.30),
               (cx + half, cy + r * 0.30), (cx + half - 40, cy + r * 0.72), (cx - half, cy + r * 0.72)],
              2.0, alpha)
    # 环带
    for i in range(5):
        x = cx - half + length * (0.14 + i * 0.17)
        a.ellipse(x, cy, 22, r * 0.78, 1.2, alpha * 0.85)
    # 舷窗排
    for row in (-0.42, 0.0, 0.42):
        for i in range(26):
            x = cx - half + 60 + i * (length - 120) / 25.0
            a.disk(x, cy + r * row, 1.7, alpha * 0.65)
    # 引擎
    for i, off in enumerate((-46, 0, 46)):
        a.polyout([(cx - half - 4, cy + off * 0.8 - 14), (cx - half - 70, cy + off - 24),
                   (cx - half - 70, cy + off + 24), (cx - half - 4, cy + off * 0.8 + 14)], 1.4, alpha)
        a.hatch([(cx - half - 8, cy + off * 0.8 - 12), (cx - half - 62, cy + off - 20),
                 (cx - half - 62, cy + off + 20), (cx - half - 8, cy + off * 0.8 + 12)], spacing=4.0, angle=70, w=0.6, a=0.30)
    # 船体排线（版画调子）
    hull = [(cx - half, cy - r * 0.72), (cx + half - 40, cy - r * 0.72), (cx + half, cy - r * 0.30),
            (cx + half, cy + r * 0.30), (cx + half - 40, cy + r * 0.72), (cx - half, cy + r * 0.72)]
    a.hatch(hull, spacing=5.4, angle=64, w=0.7, a=0.26)
    a.hatch([(cx - half, cy), (cx + half, cy), (cx + half, cy + r * 0.72), (cx - half, cy + r * 0.72)],
            spacing=9.0, angle=-40, w=0.7, a=0.18)
    # 引擎尾焰（排线锥）
    for off in (-46, 0, 46):
        plume = [(cx - half - 6, cy + off * 0.8 - 12), (cx - half - 210, cy + off - 54),
                 (cx - half - 210, cy + off + 54), (cx - half - 6, cy + off * 0.8 + 12)]
        a.hatch(plume, spacing=6.0, angle=70, w=0.7, a=0.20)
        a.polyout(plume, 1.2, alpha * 0.5)
    # 环轨与脚手架
    a.ellipse(cx, cy + 74, half * 0.92, 44, 0.9, alpha * 0.30)
    for i in range(3):
        x = cx - 200 + i * 200
        a.line([(x, cy + 72), (x, cy + 132)], 1.0, alpha * 0.5)
        a.line([(x - 16, cy + 132), (x + 16, cy + 132)], 1.0, alpha * 0.5)
    return (cx - half - 70, cy)


def rails(a, vp=(860, 470), bottom_y=880):
    # 铁轨透视
    lx0, lx1 = 360, 1500
    lx = 40
    a.line([(lx0, bottom_y), vp], 1.7, 0.85)
    a.line([(lx1, bottom_y), vp], 1.7, 0.85)
    a.line([(lx0 + 40, bottom_y), (vp[0] + 14, vp[1])], 1.0, 0.45)
    a.line([(lx1 - 40, bottom_y), (vp[0] - 14, vp[1])], 1.0, 0.45)
    n = 14
    for i in range(n):
        t = (i / float(n)) ** 1.6
        y = bottom_y - (bottom_y - vp[1] - 30) * t
        half = (lx1 - lx0) / 2.0 * (1.0 - 0.92 * t)
        cx = vp[0] + (940 - vp[0]) * (1.0 - t)
        a.line([(cx - half, y), (cx + half, y)], max(0.8, 3.6 - 2.6 * t), 0.6 - 0.2 * t)


def pylon(a, x, base_y, h, alpha=0.8):
    w = h * 0.20
    a.line([(x - w, base_y), (x - w * 0.34, base_y - h)], 1.2, alpha)
    a.line([(x + w, base_y), (x + w * 0.34, base_y - h)], 1.2, alpha)
    for i in range(3):
        yy = base_y - h * (0.32 + i * 0.22)
        half = w * (0.86 - i * 0.18)
        a.line([(x - half, yy), (x + half, yy)], 1.0, alpha)
    a.line([(x - w * 1.9, base_y - h * 0.86), (x + w * 1.9, base_y - h * 0.86)], 1.2, alpha)
    a.line([(x - w * 1.4, base_y - h * 0.72), (x + w * 1.4, base_y - h * 0.72)], 0.9, alpha * 0.8)
    for i in range(3):
        a.line([(x - w * 0.34 - i * 6, base_y - h * (0.12 + i * 0.2)), (x + w * 0.34 + i * 6, base_y - h * (0.2 + i * 0.2))], 0.5, alpha * 0.35)


def wire(a, p0, p1, sag=26.0, w=0.8, alpha=0.55):
    pts = []
    for i in range(13):
        t = i / 12.0
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t + math.sin(math.pi * t) * sag
        pts.append((x, y))
    a.line(pts, w, alpha)


def crater(a, cx, cy, rx, ry, alpha=0.7):
    a.ellipse(cx, cy, rx, ry, 1.2, alpha)
    a.ellipse(cx, cy, rx * 0.72, ry * 0.70, 0.7, alpha * 0.5)
    a.hatch([(cx - rx, cy), (cx - rx * 0.6, cy - ry * 0.9), (cx + rx * 0.2, cy - ry * 0.8),
             (cx + rx, cy - ry * 0.1), (cx + rx * 0.7, cy + ry * 0.9), (cx - rx * 0.4, cy + ry * 0.8)],
            spacing=4.5, angle=-38, w=0.6, a=0.34)


def aurora(a, x0=100, x1=1500, y=430, n=9, alpha=0.30):
    for i in range(n):
        x = x0 + (x1 - x0) * (i + a.rng.uniform(0.1, 0.8)) / n
        pts = [(x, y)]
        y2 = y
        for k in range(5):
            y2 -= a.rng.uniform(34, 64)
            pts.append((pts[-1][0] + a.rng.uniform(-22, 22), y2))
        a.dashed(pts, 6.0, 9.0, 0.8, alpha * a.rng.uniform(0.6, 1.3))


# ----------------------------------------------------------------------------
# 场景库
# ----------------------------------------------------------------------------
def scene_dawn(a):
    sky_base(a, 616, stars=60)
    horizon_line(a, 616, 0.6)
    ridge(a, 616, 140, 2)
    sun(a, 300, 300, 74)
    sun(a, 452, 372, 40, rays=False)
    sun(a, 236, 430, 24, rays=False)
    x = 780.0
    while x < 1500:
        w = a.rng.uniform(26, 78)
        h = a.rng.uniform(20, 120)
        a.fill([(x, 616), (x + w * 0.30, 616 - h), (x + w * 0.72, 616 - h * 0.86), (x + w, 616)], 0.90)
        for i in range(int(max(1, w * h / 900))):
            px = x + a.rng.uniform(4, max(5, w - 4))
            py = 610 - a.rng.uniform(4, max(6, h - 4))
            a.line([(px, py), (px + 3.0, py)], 1.0, 0.55, color=PAPER)
        x += w + a.rng.uniform(4, 30)
    ground(a, 616, 7.4, 0.34)
    for i in range(10):
        pts = [(a.rng.uniform(60, 1520), a.rng.uniform(650, 840))]
        for k in range(5):
            pts.append((pts[-1][0] + a.rng.uniform(-90, 90), pts[-1][1] + a.rng.uniform(-40, 42)))
        a.line(pts, 1.0, 0.38)
    a.line([(214, 856), (206, 660), (196, 600)], 3.0, 0.92)
    a.line([(208, 754), (138, 664), (108, 622)], 2.2, 0.85)
    a.line([(205, 700), (268, 610), (300, 580)], 2.0, 0.82)
    a.line([(205, 800), (262, 742)], 1.6, 0.70)
    a.line([(207, 690), (154, 672)], 1.3, 0.60)
    a.line([(1180, 856), (1120, 700), (1046, 652)], 2.4, 0.80)
    a.line([(1180, 856), (1246, 700), (1310, 672)], 2.0, 0.70)
    a.circle(1046, 646, 12, 1.2, 0.70)
    foreground(a, 868, 18, 0.40)
    beacon(a, 1306, 666, 6)
def scene_long_night(a):
    a.stars(340, 50, 50, W - 50, 570, 0.22, 0.80)
    paper_moon(a, 1200, 190, 64, cut=(26, -20, 0.94))
    aurora(a, 120, 760, 470, 6, 0.30)
    horizon_line(a, 578, 0.60)
    ridge(a, 578, 92, 2)
    ground(a, 578, 10.0, 0.22)
    # 冰面反光
    for i in range(60):
        x = a.rng.uniform(60, 1540)
        y = a.rng.uniform(640, 850)
        a.line([(x, y), (x + a.rng.uniform(10, 40), y - a.rng.uniform(2, 8))], 0.6, 0.22)
    # 观测塔
    a.line([(400, 860), (400, 560)], 2.0, 0.85)
    a.line([(400, 560), (470, 600)], 1.4, 0.8)
    a.line([(400, 620), (360, 860)], 1.2, 0.6)
    a.line([(400, 620), (452, 860)], 1.2, 0.6)
    a.line([(366, 700), (436, 700)], 0.9, 0.5)
    a.line([(352, 780), (452, 780)], 0.9, 0.5)
    a.circle(470, 596, 7, 1.1, 0.8)
    # 队列与人
    person(a, 980, 812, 92, 0.9, cloak=True)
    person(a, 1064, 806, 84, 0.9, lantern=0.92)
    person(a, 1142, 818, 88, 0.88, cloak=True)
    person(a, 1216, 810, 78, 0.86)
    # 提灯光
    for i in range(5):
        ang = -1.0 + i * 0.5
        a.line([(1096, 750), (1096 + math.cos(ang) * 70, 750 + math.sin(ang) * 40)], 0.7, 0.30)
    # 远处营地帐
    for i in range(3):
        bx = 700 + i * 90
        a.polyout([(bx - 40, 860), (bx, 790), (bx + 40, 860)], 1.0, 0.55)
    a.stipple([(50, 840), (700, 840), (700, 880), (50, 880)], 90, 0.5, 1.1, 0.22)


def scene_ice_river(a):
    sky_base(a, 520, 80, 0.035)
    horizon_line(a, 520, 0.55)
    ridge(a, 520, 116, 2)
    sun(a, 306, 258, 34, rays=True)
    ground(a, 520, 9.5, 0.22)
    # 河道
    left = [(690, 520), (636, 604), (548, 700), (430, 862)]
    right = [(858, 520), (968, 610), (1116, 724), (1268, 862)]
    river = left + right[::-1]
    a.hatch(river, spacing=7.0, angle=82, w=0.7, a=0.16)
    def curve(pts, seg=26):
        out = []
        for i in range(len(pts) - 1):
            x0, y0 = pts[i]
            x1, y1 = pts[i + 1]
            for k in range(seg):
                t = k / float(seg)
                out.append((x0 + (x1 - x0) * t + math.sin(math.pi * t) * 22 * (1 if i % 2 == 0 else -1),
                            y0 + (y1 - y0) * t))
        out.append(pts[-1])
        return out
    a.line(curve(left), 1.9, 0.85)
    a.line(curve(right), 1.9, 0.85)
    for off in (24, 48, 72):
        a.line(curve([(x + off * 0.2, y) for x, y in left]), 0.7, 0.22)
        a.line(curve([(x - off * 0.2, y) for x, y in right]), 0.7, 0.22)
    # 冰块
    for i in range(16):
        t = a.rng.uniform(0, 1)
        side = a.rng.choice([0, 1])
        base = left if side == 0 else right
        idx = min(len(base) - 2, int(t * (len(base) - 1)))
        bx, by = base[idx]
        s = a.rng.uniform(10, 34)
        a.polyout([(bx - s, by), (bx - s * 0.3, by - s * 0.7), (bx + s * 0.8, by - s * 0.2), (bx + s * 0.5, by + s * 0.4)], 0.8, 0.40)
        a.hatch([(bx - s, by), (bx - s * 0.3, by - s * 0.7), (bx + s * 0.8, by - s * 0.2), (bx + s * 0.5, by + s * 0.4)], spacing=3.4, angle=55, w=0.5, a=0.22)
    # 桥
    a.arc(760, 700, 210, 200, 340, 1.6, 0.8)
    a.line([(556, 640), (966, 640)], 1.6, 0.8)
    a.line([(556, 648), (966, 648)], 0.8, 0.4)
    for i in range(9):
        bx = 570 + i * 46
        a.line([(bx, 648), (bx, 700 - abs(bx - 760) * 0.24)], 0.7, 0.45)
    for i in range(3):
        person(a, 700 + i * 52, 636, 52, 0.85)
    a.stipple([(60, 800), (1540, 800), (1540, 880), (60, 880)], 150, 0.4, 1.0, 0.20)


def scene_feast(a):
    for i in range(5):
        x = 120 + i * 340
        a.line([(x, 40), (x, 560)], 1.2, 0.22)
    a.arc(800, 560, 330, 180, 360, 2.6, 0.90)
    a.arc(800, 560, 292, 180, 360, 1.0, 0.35)
    for i in range(13):
        ang = math.pi + i * math.pi / 12.0
        a.line([(800 + math.cos(ang) * 292, 560 + math.sin(ang) * 292),
                (800 + math.cos(ang) * 330, 560 + math.sin(ang) * 330)], 0.9, 0.40)
    a.line([(470, 560), (1130, 560)], 2.0, 0.85)
    for i in range(6):
        bx = 250 + i * 220
        a.line([(bx, 40), (bx, 96)], 0.9, 0.40)
        a.polyout([(bx - 34, 96), (bx + 34, 106), (bx + 34, 186), (bx - 34, 176)], 1.2, 0.55)
        a.hatch([(bx - 34, 96), (bx + 34, 106), (bx + 34, 186), (bx - 34, 176)], spacing=5.0, angle=72, w=0.6, a=0.22)
    table = [(480, 864), (1120, 864), (930, 566), (670, 566)]
    a.fill(table, 0.30)
    a.polyout(table, 2.2, 0.90)
    a.hatch(table, spacing=8.0, angle=-16, w=0.7, a=0.22)
    for lx in (520, 1080, 690, 910):
        a.line([(lx, 864), (lx, 906)], 1.6, 0.60)
    for i in range(8):
        t = (i + 0.5) / 8.0
        y = 596 + t * 250
        cx = 800
        half = 100 + t * 120
        a.ellipse(cx, y, half * 0.30, 6 + t * 7, 1.4, 0.70)
        a.ellipse(cx, y, half * 0.22, 4 + t * 5, 1.0, 0.40)
        a.arc(cx - half * 0.44, y, 13 + t * 12, 0, 180, 1.1, 0.60)
        a.arc(cx + half * 0.44, y, 13 + t * 12, 0, 180, 1.1, 0.60)
        a.rect(cx + half * 0.24 - 6, y - 18 - t * 8, cx + half * 0.24 + 6, y - t * 8, 0.9, 0.55)
    a.line([(800, 40), (800, 250)], 0.9, 0.40)
    a.polyout([(772, 250), (828, 250), (812, 300), (788, 300)], 1.4, 0.80)
    a.hatch([(772, 250), (828, 250), (812, 300), (788, 300)], spacing=4.0, angle=60, w=0.6, a=0.30)
    for i in range(6):
        ang = math.pi + i * math.pi / 5.0
        a.line([(800, 296), (800 + math.cos(ang) * 52, 296 + math.sin(ang) * 26)], 0.8, 0.30)
    for i in range(6):
        h = 96 - i * 7
        person(a, 250 + i * 26, 866 - i * 4, h, 0.88, cloak=True)
        person(a, 1350 - i * 26, 866 - i * 4, h, 0.88, cloak=True)
    for i in range(7):
        person(a, 470 + i * 110, 580 + a.rng.uniform(-6, 6), 44 + a.rng.uniform(-4, 4), 0.80, cloak=True)
    foreground(a, 878, 12, 0.35)
    beacon(a, 800, 236, 8)
def scene_famine(a):
    sky_base(a, 574, stars=36, grid_a=0.03)
    horizon_line(a, 574, 0.55)
    ridge(a, 574, 70, 2)
    ground(a, 574, 9.0, 0.34)
    # 龟裂
    for i in range(10):
        pts = [(a.rng.uniform(60, 1540), a.rng.uniform(620, 860))]
        for k in range(5):
            pts.append((pts[-1][0] + a.rng.uniform(-90, 90), pts[-1][1] + a.rng.uniform(-30, 34)))
        a.line(pts, 0.9, 0.35)
        if a.rng.random() < 0.5:
            mx, my = pts[2]
            a.line([(mx, my), (mx + a.rng.uniform(-70, 70), my + a.rng.uniform(-40, 40))], 0.7, 0.28)
    # 枯作物
    for row in range(5):
        y = 660 + row * 46
        for i in range(90):
            x = 40 + i * 17.4 + a.rng.uniform(-3, 3)
            h = a.rng.uniform(4, 13) * (1.0 - row * 0.10)
            a.line([(x, y), (x + a.rng.uniform(-3, 3), y - h)], 0.6, 0.30)
    # 水塔
    tx = 1250
    a.line([(tx - 74, 862), (tx - 30, 596)], 1.6, 0.85)
    a.line([(tx + 74, 862), (tx + 30, 596)], 1.6, 0.85)
    a.line([(tx - 30, 596), (tx - 30, 540)], 1.2, 0.7)
    a.line([(tx + 30, 596), (tx + 30, 540)], 1.2, 0.7)
    a.polyout([(tx - 52, 540), (tx + 52, 540), (tx + 40, 490), (tx - 40, 490)], 1.4, 0.85)
    a.hatch([(tx - 52, 540), (tx + 52, 540), (tx + 40, 490), (tx - 40, 490)], spacing=4.5, angle=60, w=0.5, a=0.25)
    a.line([(tx - 40, 490), (tx, 470), (tx + 40, 490)], 1.0, 0.6)
    for i in range(3):
        a.line([(tx - 62 + i * 2, 628 + i * 78), (tx + 62 - i * 2, 628 + i * 78)], 0.7, 0.35)
    # 排队的人
    for i in range(6):
        person(a, 240 + i * 96, 832 - i * 8, 84 - i * 3, 0.85, cloak=(i % 2 == 0))
    a.yfill([(742, 792), (762, 792), (758, 812), (746, 812)], 0.9)
    for i in range(4):
        ang = -1.2 + i * 0.6
        a.line([(752, 796), (752 + math.cos(ang) * 60, 796 + math.sin(ang) * 30)], 0.7, 0.28)
    # 乌鸦
    for i in range(7):
        x = a.rng.uniform(150, 1400)
        y = a.rng.uniform(150, 420)
        s = a.rng.uniform(6, 13)
        a.line([(x - s, y), (x, y - s * 0.5)], 0.9, 0.6)
        a.line([(x + s, y), (x, y - s * 0.5)], 0.9, 0.6)


def scene_cult(a):
    a.stars(210, 50, 50, W - 50, 520, 0.25, 0.8)
    horizon_line(a, 648, 0.5)
    ground(a, 648, 7.0, 0.26)
    for r in (110, 190, 280, 380):
        a.ellipse(800, 770, r * 1.62, r * 0.52, 1.0, 0.42)
        a.ellipse(800, 770, r * 1.62 + 4, r * 0.52 + 3, 0.6, 0.20)
    # 方尖碑
    a.polyout([(756, 772), (772, 246), (800, 200), (828, 246), (844, 772)], 2.0, 0.9)
    a.hatch([(756, 772), (772, 246), (800, 200), (828, 246), (844, 772)], spacing=5.0, angle=86, w=0.6, a=0.32)
    a.line([(800, 200), (800, 148)], 1.3, 0.65)
    a.circle(800, 142, 6, 1.0, 0.7)
    for i in range(9):
        ang = -1.35 + i * 0.34
        a.line([(800, 150), (800 + math.cos(ang) * 120, 150 + math.sin(ang) * 120)], 0.7, 0.28)
    # 信号黄刻线
    a.yfill([(792, 236), (808, 236), (808, 470), (792, 486)], 0.20)
    a.line([(800, 250), (800, 540)], 1.4, 0.55)
    # 环列披风人
    for i in range(10):
        ang = math.pi * 2 * i / 10.0 + 0.3
        x = 800 + math.cos(ang) * 430
        y = 792 + math.sin(ang) * 132
        person(a, x, y, 88, 0.82, cloak=True)
    # 地面符号
    a.crossesquare(800, 790, 16, 0.35, 0.9)
    a.dashed_circle(800, 790, 60, 16, 12, 0.9, 0.30)


def scene_debate(a):
    sky_base(a, 640, stars=0, grid_a=0.03)
    # 星空圆窗
    a.disk(800, 320, 236, 0.10)
    a.circle(800, 320, 238, 2.0, 0.8)
    a.circle(800, 320, 210, 0.8, 0.32)
    a.stars(90, 590, 110, 1010, 530, 0.25, 0.8)
    a.ellipse(800, 320, 186, 62, 1.0, 0.45)
    a.ellipse(800, 320, 120, 40, 0.8, 0.30)
    a.ydisk(912, 246, 9, 0.9)
    a.dashed_circle(800, 320, 224, 16, 12, 0.7, 0.25)
    # 地台
    a.line([(40, 634), (1560, 634)], 1.8, 0.85)
    a.line([(40, 646), (1560, 646)], 0.8, 0.35)
    perspective_floor(a, 646, 800, 580, rows=3, spacing=78, alpha=0.14)
    # 阶梯看台与人头
    for row, y in enumerate((676, 736, 800, 862)):
        a.line([(100 + row * 30, y), (1500 - row * 30, y)], 1.2, 0.45)
        count = 9 + row * 3
        for i in range(count):
            hx = 130 + row * 26 + (i + 0.5) * (1340 - row * 52) / count
            a.disk(hx, y - 16, 10 + row * 1.4, 0.80)
            a.line([(hx - 12, y - 4), (hx + 12, y - 4)], 1.4, 0.6)
    # 发言台
    a.rectfill(236, 700, 392, 866, 0.90)
    a.rect(226, 692, 402, 866, 1.4, 0.7)
    person(a, 312, 700, 168, 0.95, arm="point")
    # 光柱
    for i in range(3):
        x = 1140 + i * 120
        a.hatch([(x, 60), (x + 54, 60), (x - 120, 640), (x - 190, 640)], spacing=11.0, angle=60, w=0.5, a=0.08)
    a.crossesquare(1080, 700, 12, 0.30, 1.0)


def scene_appeal(a):
    # 高窗
    for i, x in enumerate((150, 560, 970, 1380)):
        a.rect(x, 120, x + 130, 500, 1.4, 0.65)
        a.arc(x + 65, 120, 65, 180, 360, 1.4, 0.65)
        for k in range(4):
            a.line([(x + 26 + k * 26, 160), (x + 26 + k * 26, 500)], 0.6, 0.28)
        for k in range(6):
            a.line([(x, 190 + k * 52), (x + 130, 190 + k * 52)], 0.6, 0.28)
    # 光柱
    for i in range(4):
        x = 150 + i * 410
        a.hatch([(x + 20, 140), (x + 110, 140), (x + 300, 866), (x + 90, 866)], spacing=13.0, angle=62, w=0.5, a=0.07)
    ground(a, 700, 10.0, 0.18)
    a.line([(40, 700), (1560, 700)], 1.2, 0.4)
    # 台阶
    for i in range(4):
        a.line([(560 - i * 40, 820 + i * 16), (1040 + i * 40, 820 + i * 16)], 1.1, 0.55)
        a.line([(560 - i * 40, 820 + i * 16), (560 - (i + 1) * 40, 836 + i * 16)], 0.8, 0.35)
        a.line([(1040 + i * 40, 820 + i * 16), (1040 + (i + 1) * 40, 836 + i * 16)], 0.8, 0.35)
    # 陈情者
    person(a, 800, 824, 262, 0.95, arm="raise")
    a.yfill([(838, 636), (872, 646), (866, 692), (832, 682)], 0.90)
    a.polyout([(838, 636), (872, 646), (866, 692), (832, 682)], 0.9, 0.6)
    # 人群
    crowd(a, 16, 160, 1440, 866, 52, 96, 0.80)
    crowd(a, 8, 400, 1200, 720, 40, 56, 0.6)
    a.crossesquare(200, 820, 10, 0.35, 1.0)


def scene_statue(a):
    sky_base(a, 540, stars=70)
    horizon_line(a, 540, 0.50)
    ridge(a, 540, 96, 2)
    # 背景施工塔架
    for i in range(4):
        x = 1080 + i * 110
        a.line([(x, 866), (x, 380)], 1.6, 0.45)
        a.line([(x - 40, 600), (x + 110, 540)], 1.0, 0.35)
        a.line([(x - 40, 700), (x + 110, 640)], 1.0, 0.35)
    a.line([(1040, 380), (1520, 380)], 1.8, 0.45)
    a.line([(1300, 380), (1300, 220)], 1.4, 0.45)
    a.line([(1300, 226), (1180, 226)], 1.2, 0.40)
    a.line([(1180, 226), (1180, 320)], 0.9, 0.35)
    # 基座
    a.polyout([(520, 866), (560, 690), (1040, 690), (1080, 866)], 2.2, 0.88)
    a.hatch([(520, 866), (560, 690), (1040, 690), (1080, 866)], spacing=6.0, angle=64, w=0.8, a=0.30)
    a.rect(560, 630, 1040, 690, 1.8, 0.85)
    a.hatch([(560, 630), (1040, 630), (1040, 690), (560, 690)], spacing=4.6, angle=-38, w=0.7, a=0.28)
    # 披风立像（暗块 + 纸色褶皱高光）
    cloak = [(754, 340), (846, 340), (900, 640), (700, 640)]
    a.fill(cloak, 0.94)
    a.hatch(cloak, spacing=4.4, angle=78, w=0.7, a=0.30)
    a.line([(800, 300), (800, 340)], 2.4, 0.9)
    a.disk(800, 296, 34, 0.94)
    a.circle(800, 296, 35, 1.8, 0.7)
    for i in range(4):
        a.line([(762 + i * 20, 350), (716 + i * 34, 636)], 1.2, 0.55, color=PAPER)
    a.line([(846, 344), (980, 300), (1010, 236)], 5.4, 0.92)
    # 火炬（信号黄）
    a.yfill([(1002, 214), (1022, 214), (1018, 246), (1006, 246)], 0.92)
    a.polyout([(1002, 214), (1022, 214), (1018, 246), (1006, 246)], 1.0, 0.7)
    # 台阶与人群
    for i in range(3):
        a.line([(440 - i * 40, 866 + i * 9), (1160 + i * 40, 866 + i * 9)], 1.2, 0.45)
    for i in range(9):
        person(a, 120 + i * 170, 858 + a.rng.uniform(-6, 6), 80 + a.rng.uniform(-12, 14), 0.85, cloak=(i % 3 == 0))
    perspective_floor(a, 700, 800, 640, rows=2, spacing=110, alpha=0.10)
    foreground(a, 884, 16, 0.28)
    annotations(a, seed_for("pol_hero_statue") % 1000)
def scene_anomaly(a):
    a.stars(300, 50, 40, W - 50, 720, 0.20, 0.82)
    a.grid(40, 40, W - 40, 760, 92, 72, 0.05)
    cx, cy = 1000, 320
    a.ydisk(cx, cy, 44, 0.95)
    a.circle(cx, cy, 46, 1.6, 0.9)
    for r in (74, 108, 152, 208, 274, 350):
        a.circle(cx, cy, r, 1.0 if r < 120 else 0.7, max(0.12, 0.62 - r / 800.0))
    sun_rays(a, cx, cy, 44, 40, 1.5, 5.2, 0.7, 0.38)
    a.dashed_circle(cx, cy, 410, 14, 10, 0.8, 0.30)
    a.dashed_circle(cx, cy, 470, 4, 20, 0.7, 0.22)
    a.cross(cx, cy, 34, 0.35, 0.9)
    # 观测站
    dish(a, 1246, 742, 118, tilt=14, alpha=0.88)
    a.line([(1246, 742 + 96), (1246, 866)], 1.2, 0.5)
    a.line([(1100, 866), (1480, 866)], 1.4, 0.5)
    # 测量标注
    a.line([(cx - 500, cy), (cx - 470, cy)], 1.0, 0.4)
    a.line([(cx + 470, cy), (cx + 500, cy)], 1.0, 0.4)
    a.line([(cx, cy - 500), (cx, cy - 470)], 1.0, 0.4)
    for i in range(5):
        ang = -0.9 + i * 0.45
        a.dashed([(cx, cy), (cx + math.cos(ang) * 420, cy + math.sin(ang) * 420)], 10, 9, 0.7, 0.18)
    # 前景地面
    a.hatch([(40, 810), (W - 40, 810), (W - 40, 880), (40, 880)], spacing=7.0, angle=-44, w=0.6, a=0.20)


def scene_astronomer(a):
    # 穹顶
    a.arc(800, 960, 806, 186, 354, 1.5, 0.55)
    a.arc(800, 960, 754, 186, 354, 0.7, 0.20)
    a.line([(40, 660), (1560, 660)], 1.4, 0.5)
    a.hatch([(40, 660), (W - 40, 660), (W - 40, H - 30), (40, H - 30)], spacing=10.0, angle=58, w=0.6, a=0.14)
    # 观测缝
    a.line([(1130, 80), (960, 660)], 2.4, 0.75)
    a.line([(1184, 90), (1016, 660)], 2.4, 0.75)
    a.line([(1100, 120), (990, 620)], 0.7, 0.3)
    a.stars(60, 980, 90, 1180, 430, 0.25, 0.8)
    # 星图板
    a.rect(120, 180, 470, 520, 1.4, 0.7)
    a.stars(40, 140, 200, 450, 500, 0.3, 0.85)
    a.ellipse(300, 350, 140, 52, 0.9, 0.45)
    a.ellipse(300, 350, 90, 32, 0.7, 0.30)
    a.circle(380, 300, 6, 1.0, 0.7)
    a.line([(140, 540), (450, 540)], 0.8, 0.4)
    # 望远镜 + 天文学家
    person(a, 640, 700, 132, 0.9, arm="point")
    telescope(a, 700, 640, 300, -22, 0.92)
    a.line([(600, 866), (600, 700)], 1.4, 0.6)
    a.rect(500, 700, 700, 866, 1.2, 0.55)
    for i in range(3):
        a.line([(520 + i * 8, 730 + i * 40), (680 - i * 10, 730 + i * 40)], 0.7, 0.35)
    # 桌面纸张
    for i in range(5):
        px = 880 + a.rng.uniform(0, 200)
        py = 690 + a.rng.uniform(0, 90)
        a.polyout([(px, py), (px + 84, py - 6), (px + 90, py + 46), (px + 4, py + 52)], 0.8, 0.4)
        a.line([(px + 10, py + 14), (px + 76, py + 10)], 0.6, 0.25)
        a.line([(px + 10, py + 26), (px + 68, py + 22)], 0.6, 0.25)
    # 台灯（黄）
    a.line([(1400, 866), (1400, 700)], 1.6, 0.7)
    a.yfill([(1378, 668), (1422, 668), (1414, 700), (1386, 700)], 0.92)
    for i in range(5):
        ang = 2.4 + i * 0.22
        a.line([(1400, 690), (1400 + math.cos(ang) * 120, 690 + math.sin(ang) * 60)], 0.7, 0.25)


def scene_archives(a):
    shelves(a, 90, 120, 700, 700, cols=4, rows=5)
    shelves(a, 740, 180, 1080, 700, cols=2, rows=4)
    a.line([(40, 700), (1560, 700)], 1.6, 0.7)
    ground(a, 700, 9.0, 0.20)
    # 拱顶文件柜
    a.arc(560, 700, 520, 180, 360, 1.0, 0.25)
    # 穹顶库门
    a.circle(1300, 470, 168, 2.2, 0.85)
    a.circle(1300, 470, 140, 1.0, 0.5)
    a.circle(1300, 470, 34, 1.4, 0.8)
    for i in range(8):
        ang = math.pi * 2 * i / 8.0
        a.line([(1300 + math.cos(ang) * 36, 470 + math.sin(ang) * 36),
                (1300 + math.cos(ang) * 138, 470 + math.sin(ang) * 138)], 1.2, 0.6)
        a.circle(1300 + math.cos(ang) * 122, 470 + math.sin(ang) * 122, 7, 0.9, 0.5)
    for i in range(12):
        ang = math.pi * 2 * i / 12.0
        a.line([(1300 + math.cos(ang) * 150, 470 + math.sin(ang) * 150),
                (1300 + math.cos(ang) * 166, 470 + math.sin(ang) * 166)], 0.8, 0.4)
    # 木梯
    a.line([(900, 866), (940, 400)], 1.6, 0.8)
    a.line([(1000, 866), (1040, 400)], 1.6, 0.8)
    for i in range(9):
        t = i / 8.0
        a.line([(900 + 40 * t, 866 - 466 * t), (1000 + 40 * t, 866 - 466 * t)], 0.9, 0.55)
    # 光柱
    for i in range(2):
        a.hatch([(80, 60), (420, 60), (760, 866), (300, 866)], spacing=14.0, angle=66, w=0.5, a=0.07)
    # 尘埃
    a.stipple([(100, 200), (900, 200), (900, 800), (100, 800)], 220, 0.4, 0.9, 0.20)
    # 黄：一只文件盒正面
    a.yfill([(880, 380), (952, 380), (952, 424), (880, 424)], 0.85)
    a.rect(880, 380, 952, 424, 0.9, 0.6)


def scene_mine(a):
    sky_base(a, 600, stars=40, grid_a=0.03)
    horizon_line(a, 600, 0.55)
    ridge(a, 600, 96, 2)
    ground(a, 600, 8.0, 0.26)
    # 井架
    a.line([(360, 866), (520, 340)], 2.0, 0.9)
    a.line([(680, 866), (520, 340)], 2.0, 0.9)
    a.line([(404, 740), (636, 740)], 1.2, 0.7)
    a.line([(440, 640), (600, 640)], 1.2, 0.7)
    a.line([(404, 740), (600, 640)], 0.9, 0.5)
    a.line([(636, 740), (440, 640)], 0.9, 0.5)
    a.circle(520, 336, 30, 1.8, 0.9)
    a.circle(520, 336, 12, 1.2, 0.7)
    for i in range(6):
        ang = math.pi * 2 * i / 6.0
        a.line([(520 + math.cos(ang) * 12, 336 + math.sin(ang) * 12),
                (520 + math.cos(ang) * 30, 336 + math.sin(ang) * 30)], 0.9, 0.6)
    a.line([(520, 336), (520, 500)], 1.0, 0.5)
    a.rect(500, 500, 540, 540, 1.0, 0.6)
    # 坑道口
    a.arc(1080, 760, 170, 180, 360, 2.0, 0.88)
    a.line([(910, 760), (1250, 760)], 2.0, 0.88)
    a.disk(1080, 760, 168, 0.10)
    a.hatch([(912, 760), (1248, 760), (1248, 866), (912, 866)], spacing=6.5, angle=70, w=0.6, a=0.16)
    for i in range(3):
        a.line([(950 + i * 130, 760), (950 + i * 130, 866)], 1.0, 0.35)
    # 轨道
    a.line([(120, 866), (1010, 646)], 1.6, 0.8)
    a.line([(210, 866), (1014, 664)], 1.6, 0.8)
    for i in range(9):
        t = i / 8.0
        x0 = 120 + (1010 - 120) * t
        y0 = 866 - (866 - 646) * t
        x1 = 210 + (1014 - 210) * t
        y1 = 866 - (866 - 664) * t
        a.line([(x0, y0), (x1, y1)], max(0.8, 2.6 - 2.0 * t), 0.6)
    # 矿车
    a.polyout([(300, 800), (420, 800), (404, 856), (316, 856)], 1.4, 0.8)
    a.hatch([(300, 800), (420, 800), (404, 856), (316, 856)], spacing=4.0, angle=50, w=0.5, a=0.28)
    a.circle(330, 860, 9, 1.1, 0.7)
    a.circle(392, 860, 9, 1.1, 0.7)
    # 碎石
    for i in range(18):
        x = a.rng.uniform(560, 1520)
        y = a.rng.uniform(760, 870)
        s = a.rng.uniform(8, 26)
        a.polyout([(x - s, y), (x - s * 0.4, y - s * 0.8), (x + s * 0.7, y - s * 0.4), (x + s, y + s * 0.2)], 0.8, 0.35)
    # 黄：坑道灯
    a.yfill([(1058, 690), (1082, 690), (1082, 712), (1058, 712)], 0.92)
    a.line([(1070, 640), (1070, 690)], 0.9, 0.5)


def scene_rail(a):
    sky_base(a, 470, stars=40, grid_a=0.03)
    horizon_line(a, 470, 0.55)
    ridge(a, 470, 108, 2)
    ground(a, 470, 8.0, 0.22)
    rails(a, vp=(866, 474), bottom_y=880)
    # 电线杆
    for i, t in enumerate((0.16, 0.36, 0.58, 0.82)):
        base_x = 150 + t * 300
        base_y = 880 - t * 400
        h = 300 - t * 210
        pylon(a, base_x, base_y, h, 0.75)
        if i > 0:
            prev_x = 150 + (t - 0.2) * 300
            prev_y = 880 - (t - 0.2) * 400
            wire(a, (prev_x, prev_y - (300 - (t - 0.2) * 210) * 0.86), (base_x, base_y - h * 0.86), sag=14, w=0.7, alpha=0.45)
            wire(a, (prev_x, prev_y - (300 - (t - 0.2) * 210) * 0.72), (base_x, base_y - h * 0.72), sag=12, w=0.6, alpha=0.35)
    # 机车
    cx, cy = 1030, 662
    a.polyout([(cx - 120, cy - 96), (cx + 40, cy - 96), (cx + 40, cy - 44), (cx - 120, cy - 44)], 1.6, 0.9)
    a.polyout([(cx - 96, cy - 44), (cx + 58, cy - 44), (cx + 70, cy - 12), (cx - 108, cy - 12)], 1.6, 0.9)
    a.disk(cx - 70, cy - 108, 10, 0.85)
    a.line([(cx - 70, cy - 108), (cx - 70, cy - 150)], 1.4, 0.7)
    a.rectfill(cx - 24, cy - 84, cx + 18, cy - 56, 0.85)
    for i in range(3):
        a.circle(cx - 74 + i * 46, cy - 4, 15, 1.2, 0.8)
    a.line([(cx + 40, cy - 70), (cx + 96, cy - 70)], 1.2, 0.6)
    a.polyout([(cx + 96, cy - 86), (cx + 120, cy - 86), (cx + 120, cy - 54), (cx + 96, cy - 54)], 1.0, 0.65)
    # 蒸汽
    for i in range(4):
        a.arc(cx - 90 + i * 18, cy - 176 - i * 16, 16 + i * 6, 180, 360, 1.0, 0.35 - i * 0.06)
    # 黄：前灯
    a.yfill([(cx - 112, cy - 66), (cx - 100, cy - 66), (cx - 100, cy - 54), (cx - 112, cy - 54)], 0.92)
    # 远处信号牌
    a.line([(420, 600), (420, 560)], 1.0, 0.5)
    a.rect(404, 520, 436, 560, 1.0, 0.6)
    a.line([(404, 540), (436, 540)], 0.8, 0.5)


def scene_generation_ship(a):
    a.stars(320, 50, 40, W - 50, 620, 0.2, 0.85)
    # 行星弧
    a.arc(800, 1420, 700, 200, 340, 2.0, 0.55)
    a.hatch([(60, 720), (W - 60, 720), (W - 60, 900), (60, 900)], spacing=9.0, angle=40, w=0.6, a=0.12)
    # 舰体
    generation_ship(a, 800, 400, 900, 0.9)
    # 轨道弧与星环
    a.dashed_circle(800, 400, 560, 18, 14, 0.9, 0.30)
    a.ellipse(800, 470, 470, 84, 0.8, 0.20)
    # 工程脚手架吊臂
    a.line([(180, 860), (300, 700)], 1.2, 0.5)


def scene_deep_probe(a):
    a.stars(300, 50, 40, W - 50, 640, 0.2, 0.85)
    # 目标星
    a.ydisk(1320, 210, 16, 0.92)
    a.circle(1320, 210, 18, 1.2, 0.8)
    for r in (60, 105, 160, 220):
        a.arc(1320, 210, r, 140, 300, 1.0, max(0.12, 0.5 - r / 700.0))
    # 探测器和轨道
    satellite(a, 700, 430, 1.15, 0.9)
    a.dashed_circle(800, 470, 430, 20, 16, 0.9, 0.28)
    a.dashed([(700, 430), (1290, 220)], 8, 12, 0.9, 0.45)
    # 行星弧
    a.arc(800, 1500, 760, 196, 344, 2.2, 0.55)
    a.hatch([(40, 800), (W - 40, 800), (W - 40, 900), (40, 900)], spacing=10.0, angle=-40, w=0.6, a=0.14)
    # 测控站天线
    dish(a, 380, 760, 86, tilt=30, alpha=0.8)
    # 标注
    a.line([(1010, 210), (1220, 210)], 0.8, 0.3)
    a.crossesquare(1010, 210, 8, 0.3, 0.9)


def scene_listening(a):
    a.stars(280, 50, 40, W - 50, 650, 0.2, 0.85)
    # 亮星与信号弧
    a.ydisk(1260, 190, 13, 0.92)
    for r in (56, 96, 140, 190, 250):
        a.arc(1260, 190, r, 130, 300, 1.0, max(0.10, 0.5 - r / 750.0))
    horizon_line(a, 640, 0.55)
    ground(a, 640, 8.5, 0.22)
    # 天线阵
    dish(a, 300, 700, 128, tilt=18, alpha=0.92)
    dish(a, 610, 730, 96, tilt=18, alpha=0.85)
    dish(a, 870, 754, 70, tilt=18, alpha=0.78)
    dish(a, 1070, 770, 52, tilt=18, alpha=0.72)
    # 桅杆
    a.line([(1430, 866), (1430, 420)], 2.0, 0.8)
    for i in range(4):
        yy = 500 + i * 78
        half = 54 - i * 8
        a.line([(1430 - half, yy), (1430 + half, yy)], 1.1, 0.6)
        a.line([(1430 - half, yy), (1430, yy + 26)], 0.7, 0.35)
        a.line([(1430 + half, yy), (1430, yy + 26)], 0.7, 0.35)
    a.line([(1430, 440), (1430, 380)], 0.9, 0.5)
    a.circle(1430, 372, 8, 1.0, 0.6)
    # 电缆
    wire(a, (360, 790), (1420, 860), sag=50, w=0.7, alpha=0.3)


def scene_prophet(a):
    a.stars(200, 50, 40, W - 50, 560, 0.25, 0.8)
    horizon_line(a, 600, 0.5)
    ground(a, 600, 8.0, 0.24)
    # 城门柱
    for x in (240, 1360):
        a.polyout([(x - 52, 866), (x - 40, 260), (x + 40, 260), (x + 52, 866)], 1.8, 0.85)
        a.hatch([(x - 52, 866), (x - 40, 260), (x + 40, 260), (x + 52, 866)], spacing=6.0, angle=72, w=0.6, a=0.22)
        a.rect(x - 66, 232, x + 66, 262, 1.4, 0.8)
        for i in range(5):
            a.line([(x - 30 + i * 15, 300), (x - 30 + i * 15, 360)], 0.6, 0.3)
    # 台阶
    for i in range(4):
        a.line([(520 - i * 30, 800 + i * 16), (1080 + i * 30, 800 + i * 16)], 1.1, 0.5)
    # 先知
    person(a, 800, 806, 330, 0.95, cloak=True, arm="raise")
    a.disk(800, 486, 44, 0.08)
    a.circle(800, 486, 46, 1.4, 0.75)
    for r in (62, 84, 112):
        a.arc(800, 486, r, 190, 350, 1.0, 0.30)
    # 人群（前景一排头颅）
    for i in range(11):
        x = 120 + i * 132
        a.disk(x, 828, 26, 0.85)
        a.hatch([(x - 30, 854), (x + 30, 854), (x + 40, 900), (x - 40, 900)], spacing=4.0, angle=60, w=0.5, a=0.25)
        a.line([(x - 30, 852), (x + 30, 852)], 1.4, 0.7)
    # 横幅
    a.line([(560, 120), (560, 300)], 1.2, 0.5)
    a.polyout([(560, 140), (700, 154), (700, 268), (560, 254)], 1.0, 0.55)
    a.hatch([(560, 140), (700, 154), (700, 268), (560, 254)], spacing=6.0, angle=64, w=0.5, a=0.18)
    # 黄：先知手中的光点
    a.yfill([(808, 520), (836, 520), (830, 552), (814, 552)], 0.9)


def scene_solar_flare(a):
    cx, cy, r = 1180, 250, 250
    a.disk(cx, cy, r, 0.05)
    a.circle(cx, cy, r, 3.2, 0.95)
    a.circle(cx, cy, r * 0.90, 1.6, 0.55)
    for i in range(6):
        a.arc(cx, cy, r * (0.18 + i * 0.13), 150, 390, 1.0, 0.30)
    for i in range(8):
        a0 = 170 + i * 24
        a.arc(cx, cy, r * (1.06 + (i % 3) * 0.09), a0, a0 + 26, 2.0, 0.55)
    for i in range(52):
        ang = 2 * math.pi * i / 52
        r0 = r * 1.02
        r1 = r * (1.10 + 0.34 * ((i * 3) % 5) / 4.0)
        a.line([(cx + math.cos(ang) * r0, cy + math.sin(ang) * r0),
                (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1)], 1.1, 0.40)
    for i in range(8):
        x0 = 60 + i * 110
        pts = [(x0, 640)]
        yy = 640
        for k in range(6):
            yy -= a.rng.uniform(40, 70)
            pts.append((pts[-1][0] + a.rng.uniform(-24, 24), yy))
        a.dashed(pts, 5, 8, 1.1, 0.30)
    horizon_line(a, 650, 0.45)
    ground(a, 650, 8.0, 0.26)
    for i in range(4):
        x = 220 + i * 320
        h = 330 - i * 24
        pylon(a, x, 780, h, 0.90)
        if i > 0:
            wire(a, (x - 320, 780 - (330 - (i - 1) * 24) * 0.86), (x, 780 - h * 0.86), sag=24, w=0.9, alpha=0.50)
            wire(a, (x - 320, 780 - (330 - (i - 1) * 24) * 0.72), (x, 780 - h * 0.72), sag=20, w=0.8, alpha=0.40)
    for i in range(3):
        person(a, 520 + i * 100, 858, 96, 0.90, arm="point")
    dish(a, 1480, 800, 62, tilt=26, alpha=0.75)
    foreground(a, 876, 18, 0.34)
    a.yfill([(cx - 12, cy - 12), (cx + 12, cy - 12), (cx + 12, cy + 12), (cx - 12, cy + 12)], 0.95)
def scene_meteor(a):
    a.stars(240, 50, 40, W - 50, 520, 0.2, 0.8)
    # 流星群
    for i in range(9):
        x = a.rng.uniform(700, 1500)
        y = a.rng.uniform(80, 400)
        ln = a.rng.uniform(120, 300)
        ang = 2.5 + a.rng.uniform(-0.18, 0.18)
        a.dashed([(x, y), (x + math.cos(ang) * ln, y + math.sin(ang) * ln)], 16, 10, 1.2, 0.55)
        a.disk(x, y, a.rng.uniform(2.5, 5.0), 0.9)
    # 大流星 + 冲击
    mx, my = 1080, 236
    a.disk(mx, my, 16, 0.95)
    a.yfill([(mx - 9, my - 9), (mx + 9, my - 9), (mx + 9, my + 9), (mx - 9, my + 9)], 0.90)
    a.dashed([(mx + 20, my + 18), (1480, 560)], 20, 12, 1.6, 0.6)
    a.hatch([(1330, 500), (1480, 540), (1520, 700), (1380, 660)], spacing=8.0, angle=45, w=0.8, a=0.30)
    # 地面
    horizon_line(a, 640, 0.5)
    ground(a, 640, 9.0, 0.24)
    crater(a, 560, 780, 220, 70, 0.72)
    crater(a, 1180, 820, 140, 46, 0.6)
    # 避难穹顶
    a.arc(1080, 690, 190, 180, 360, 1.8, 0.8)
    a.line([(890, 690), (1270, 690)], 1.8, 0.8)
    for i in range(9):
        ang = math.pi + i * math.pi / 8.0
        a.line([(1080 + math.cos(ang) * 190, 690 + math.sin(ang) * 190),
                (1080 + math.cos(ang) * 214, 690 + math.sin(ang) * 214)], 0.7, 0.35)
    # 奔跑的人
    for i in range(4):
        person(a, 300 + i * 90, 860, 84, 0.85, arm="raise")
    # 观测望远镜
    a.line([(1460, 860), (1460, 620)], 1.6, 0.7)
    a.line([(1460, 640), (1370, 560)], 1.4, 0.75)


def scene_factory(a):
    a.grid(60, 60, W - 60, 520, 110, 86, 0.04)
    # 锯齿屋顶
    for i in range(7):
        x = 940 + i * 82
        a.line([(x, 300), (x, 380), (x + 82, 380), (x + 82, 300)], 1.0, 0.4)
    a.line([(940, 380), (1540, 380)], 1.6, 0.7)
    a.line([(940, 380), (940, 660)], 1.6, 0.7)
    # 厂房窗
    for i in range(5):
        for k in range(4):
            x = 980 + i * 108
            y = 430 + k * 56
            a.rect(x, y, x + 66, y + 34, 0.9, 0.5)
            a.hatch([(x, y), (x + 66, y), (x + 66, y + 34), (x, y + 34)], spacing=4.0, angle=45, w=0.5, a=0.20)
    # 烟囱
    chimney(a, 1300, 866, 96, 440)
    chimney(a, 1440, 866, 74, 320)
    # 齿轮
    gear(a, 420, 620, 176, 18, 0.85)
    gear(a, 660, 720, 118, 14, 0.8)
    # 传送带 / 桁架
    a.line([(60, 800), (330, 720)], 2.0, 0.75)
    a.line([(60, 840), (330, 760)], 1.4, 0.55)
    for i in range(8):
        t = i / 7.0
        a.line([(60 + 270 * t, 800 - 80 * t), (60 + 270 * t, 840 - 80 * t)], 0.9, 0.45)
    # 吊车
    a.line([(880, 866), (880, 240)], 2.4, 0.8)
    a.line([(880, 240), (1560, 240)], 2.0, 0.8)
    a.line([(880, 300), (1160, 240)], 1.2, 0.5)
    a.line([(1140, 240), (1140, 360)], 0.9, 0.5)
    a.polyout([(1118, 360), (1162, 360), (1152, 400), (1128, 400)], 1.0, 0.6)
    # 工人
    for i in range(4):
        person(a, 780 + i * 60, 860, 78, 0.8, arm="raise")
    ground(a, 660, 8.0, 0.18)
    # 黄：熔炉口
    a.yfill([(160, 540), (248, 540), (232, 604), (176, 604)], 0.88)
    a.arc(204, 600, 40, 0, 180, 1.2, 0.6)


def scene_lab(a):
    a.grid(60, 60, W - 60, 560, 96, 76, 0.05)
    # 环形装置
    cx, cy, r = 800, 360, 230
    a.circle(cx, cy, r, 2.6, 0.9)
    a.circle(cx, cy, r * 0.82, 1.2, 0.55)
    a.circle(cx, cy, r * 0.62, 0.9, 0.35)
    a.circle(cx, cy, r * 0.30, 1.6, 0.8)
    for i in range(16):
        ang = math.pi * 2 * i / 16.0
        x0 = cx + math.cos(ang) * r
        y0 = cy + math.sin(ang) * r
        a.line([(x0, y0), (cx + math.cos(ang) * (r + 26), cy + math.sin(ang) * (r + 26))], 3.0, 0.55)
        a.rect(cx + math.cos(ang) * (r + 20) - 10, cy + math.sin(ang) * (r + 20) - 10,
               cx + math.cos(ang) * (r + 20) + 10, cy + math.sin(ang) * (r + 20) + 10, 0.9, 0.45)
    for i in range(6):
        ang = math.pi * 2 * i / 6.0
        a.line([(cx + math.cos(ang) * r * 0.30, cy + math.sin(ang) * r * 0.30),
                (cx + math.cos(ang) * r * 0.82, cy + math.sin(ang) * r * 0.82)], 0.8, 0.3)
    # 等离子环（黄）
    a.arc(cx, cy, r * 0.46, 20, 160, 3.0, 0.55)
    # 控制台
    a.rect(120, 620, 620, 820, 1.4, 0.75)
    a.hatch([(120, 620), (620, 620), (620, 820), (120, 820)], spacing=6.0, angle=60, w=0.6, a=0.16)
    for i in range(3):
        a.rect(150 + i * 150, 660, 270 + i * 150, 760, 1.0, 0.5)
        # 波形
        pts = [(160 + i * 150, 710)]
        for k in range(11):
            pts.append((160 + i * 150 + k * 10, 710 - math.sin(k * 1.3 + i) * 22))
        a.line(pts, 0.9, 0.6)
    # 机柜
    for i in range(3):
        a.rect(1050 + i * 110, 600, 1130 + i * 110, 830, 1.2, 0.65)
        for k in range(6):
            a.line([(1058 + i * 110, 630 + k * 30), (1122 + i * 110, 630 + k * 30)], 0.6, 0.3)
        a.circle(1090 + i * 110, 590, 7, 0.9, 0.5)
    # 人物
    person(a, 700, 866, 130, 0.9, arm="point")
    person(a, 900, 870, 118, 0.85)
    # 电缆
    wire(a, (620, 810), (1050, 700), sag=40, w=1.2, alpha=0.5)
    wire(a, (900, 800), (1220, 760), sag=26, w=0.9, alpha=0.4)


def scene_ruins(a):
    sky_base(a, 620, stars=60, grid_a=0.03)
    horizon_line(a, 620, 0.5)
    ridge(a, 620, 110, 2)
    ground(a, 620, 9.0, 0.28)
    # 断塔
    a.polyout([(400, 866), (386, 300), (520, 240), (540, 866)], 1.8, 0.85)
    a.hatch([(400, 866), (386, 300), (520, 240), (540, 866)], spacing=6.0, angle=68, w=0.6, a=0.22)
    for i in range(6):
        y = 340 + i * 86
        a.line([(390, y), (505, y + a.rng.uniform(-20, 10))], 0.8, 0.4)
    a.line([(386, 300), (300, 480)], 1.6, 0.7)
    a.line([(520, 240), (640, 380)], 1.4, 0.65)
    # 斜梁
    a.line([(200, 866), (700, 420)], 1.6, 0.6)
    a.line([(240, 866), (740, 460)], 1.2, 0.45)
    # 废墟堆
    for i in range(16):
        x = a.rng.uniform(80, 1520)
        y = a.rng.uniform(740, 870)
        s = a.rng.uniform(14, 44)
        a.polyout([(x - s, y), (x - s * 0.2, y - s * 0.8), (x + s * 0.8, y - s * 0.3), (x + s, y + s * 0.2)], 0.9, 0.40)
    # 烟柱
    a.hatch([(1160, 400), (1260, 400), (1330, 180), (1220, 180)], spacing=6.0, angle=78, w=0.6, a=0.20)
    a.line([(1160, 400), (1220, 180)], 1.2, 0.5)
    a.line([(1260, 400), (1330, 180)], 1.2, 0.5)
    # 信号塔
    pylon(a, 1420, 866, 300, 0.7)
    a.yfill([(1412, 552), (1428, 552), (1428, 566), (1412, 566)], 0.9)
    # 飞鸟
    for i in range(5):
        x = a.rng.uniform(150, 900)
        y = a.rng.uniform(180, 400)
        s = a.rng.uniform(7, 14)
        a.line([(x - s, y), (x, y - s * 0.5)], 0.9, 0.5)
        a.line([(x + s, y), (x, y - s * 0.5)], 0.9, 0.5)


def scene_crowd(a):
    sky_base(a, 520, stars=50, grid_a=0.04)
    horizon_line(a, 520, 0.5)
    ridge(a, 520, 70, 2)
    ground(a, 520, 9.0, 0.20)
    perspective_floor(a, 520, 800, 500, rows=3, spacing=100, alpha=0.12)
    # 纪念碑 / 城门框
    a.polyout([(660, 866), (676, 300), (924, 300), (940, 866)], 1.6, 0.6)
    a.hatch([(660, 866), (676, 300), (924, 300), (940, 866)], spacing=9.0, angle=64, w=0.6, a=0.12)
    # 人群层次
    crowd(a, 10, 120, 500, 760, 50, 74, 0.8, cloak=True)
    crowd(a, 12, 980, 1480, 800, 56, 88, 0.85, cloak=True)
    crowd(a, 16, 200, 1400, 872, 64, 104, 0.9)
    # 横幅
    for i in range(4):
        bx = 300 + i * 320
        a.line([(bx, 100), (bx, 260)], 1.1, 0.5)
        a.polyout([(bx, 120), (bx + 130, 136), (bx + 130, 236), (bx, 220)], 1.0, 0.55)
        a.hatch([(bx, 120), (bx + 130, 136), (bx + 130, 236), (bx, 220)], spacing=5.5, angle=60, w=0.5, a=0.18)
    # 黄：横幅一角
    a.yfill([(300, 120), (330, 126), (330, 220), (300, 214)], 0.30)
    # 讲台与发言人
    a.rectfill(770, 700, 850, 866, 0.85)
    person(a, 810, 700, 96, 0.9, arm="raise")


def scene_map(a):
    a.stars(340, 50, 40, W - 50, 800, 0.2, 0.85)
    a.grid(40, 40, W - 40, 860, 100, 80, 0.07)
    # 三星
    stars_pos = [(520, 300, 26), (1010, 260, 34), (800, 520, 20)]
    for i, (x, y, r) in enumerate(stars_pos):
        if i == 1:
            a.ydisk(x, y, r * 0.7, 0.92)
        a.disk(x, y, r, 0.92 if i != 1 else 0.0)
        a.circle(x, y, r, 1.6, 0.85)
        a.circle(x, y, r * 1.5, 0.8, 0.30)
        a.dashed_circle(x, y, r * 3.0, 10, 8, 0.7, 0.22)
    # 三角连线
    a.line([(520, 300), (1010, 260)], 0.8, 0.30)
    a.line([(1010, 260), (800, 520)], 0.8, 0.30)
    a.line([(800, 520), (520, 300)], 0.8, 0.30)
    # 轨道
    a.ellipse(760, 380, 420, 130, 1.0, 0.25)
    a.ellipse(760, 380, 320, 96, 0.8, 0.20)
    a.ellipse(760, 380, 540, 190, 0.8, 0.14)
    # 测量圆与标尺
    a.crossesquare(760, 380, 18, 0.35, 1.2)
    a.ruler(60, 1540, 846, 22.0, 5, 4.0, 9.0, 0.7, 0.30)
    a.line([(60, 820), (1540, 820)], 0.7, 0.25)
    # 坐标刻度
    for i in range(6):
        x = 150 + i * 260
        a.line([(x, 60), (x, 90)], 0.8, 0.3)
        a.line([(x, 816), (x, 840)], 0.8, 0.3)
    a.cross(1420, 160, 16, 0.35, 1.0)
    a.cross(180, 720, 12, 0.30, 0.9)


def scene_storm(a):
    a.stars(30, 50, 40, W - 50, 360, 0.2, 0.5)
    horizon_line(a, 600, 0.5)
    ridge(a, 600, 120, 2)
    # 尘幕 / 雨幕：多层斜向排线
    for i in range(5):
        x0 = -200 + i * 260
        a.hatch([(x0, 40), (x0 + 520, 40), (x0 + 210, 640), (x0 - 310, 640)],
                spacing=9.0 - i * 0.8, angle=62, w=0.7, a=0.10 + i * 0.015)
    # 风线
    for i in range(26):
        x = a.rng.uniform(40, 1520)
        y = a.rng.uniform(120, 620)
        ln = a.rng.uniform(50, 190)
        a.dashed([(x, y), (x + ln, y + a.rng.uniform(-14, 14))], 8, 10, 0.9, 0.35)
    ground(a, 600, 8.0, 0.32)
    # 被风压弯的树
    for i in range(3):
        bx = 210 + i * 150
        by = 860 - i * 20
        h = 220 - i * 30
        a.line([(bx, by), (bx - 30, by - h * 0.55), (bx - 40, by - h)], 2.6, 0.9)
        for k in range(4):
            a.line([(bx - 26 - k * 5, by - h * (0.55 + k * 0.1)), (bx - 96 - k * 12, by - h * (0.62 + k * 0.1))], 1.4, 0.7)
    # 废弃观测站
    a.polyout([(1080, 720), (1120, 500), (1260, 500), (1300, 720)], 1.8, 0.8)
    a.hatch([(1080, 720), (1120, 500), (1260, 500), (1300, 720)], spacing=6.0, angle=68, w=0.7, a=0.30)
    a.polyout([(1120, 430), (1260, 430), (1190, 500)], 1.4, 0.7)
    dish(a, 1420, 780, 76, tilt=36, alpha=0.8)
    # 引水渠 / 堤坝
    a.line([(40, 760), (520, 722)], 1.8, 0.6)
    a.line([(40, 786), (520, 750)], 1.2, 0.45)
    for i in range(9):
        t = i / 8.0
        a.line([(40 + t * 480, 760 - t * 38), (40 + t * 480, 786 - t * 36)], 0.8, 0.35)
    foreground(a, 842, 30, 0.55)
    beacon(a, 1196, 452, 7)
    a.crossesquare(1180, 560, 10, 0.3, 0.9)


# ----------------------------------------------------------------------------
# 事件 id -> 场景路由
# ----------------------------------------------------------------------------
SCENES = {
    "dawn": scene_dawn,
    "long_night": scene_long_night,
    "ice_river": scene_ice_river,
    "feast": scene_feast,
    "famine": scene_famine,
    "cult": scene_cult,
    "debate": scene_debate,
    "appeal": scene_appeal,
    "statue": scene_statue,
    "anomaly": scene_anomaly,
    "astronomer": scene_astronomer,
    "archives": scene_archives,
    "mine": scene_mine,
    "rail": scene_rail,
    "generation_ship": scene_generation_ship,
    "deep_probe": scene_deep_probe,
    "listening": scene_listening,
    "prophet": scene_prophet,
    "solar_flare": scene_solar_flare,
    "meteor": scene_meteor,
    "factory": scene_factory,
    "lab": scene_lab,
    "ruins": scene_ruins,
    "crowd": scene_crowd,
    "map": scene_map,
    "storm": scene_storm,
}

KEYWORDS = [
    ("red_dawn", "dawn"), ("dawn", "dawn"), ("sunrise", "dawn"), ("quiet_spring", "dawn"),
    ("dust", "storm"), ("storm", "storm"), ("rain", "storm"), ("wind", "storm"), ("sand", "storm"),
    ("cold", "ice_river"), ("flood", "ice_river"), ("rain", "storm"),
    ("long_night", "long_night"), ("night", "long_night"), ("eclipse", "long_night"),
    ("ice", "ice_river"), ("frost", "ice_river"), ("river", "ice_river"), ("glacier", "ice_river"),
    ("feast", "feast"), ("harvest", "feast"), ("banquet", "feast"),
    ("famine", "famine"), ("starve", "famine"), ("hunger", "famine"), ("drought", "famine"),
    ("cult", "cult"), ("ritual", "cult"), ("sect", "cult"), ("dream", "anomaly"), ("loop", "anomaly"),
    ("fusion", "lab"), ("plague", "crowd"), ("fire", "ruins"), ("quake", "ruins"),
    ("underground", "archives"), ("migrant", "crowd"), ("birth", "crowd"), ("school", "crowd"),
    ("orbit", "deep_probe"), ("steam", "factory"), ("radiation", "anomaly"),
    ("prophet", "prophet"), ("oracle", "prophet"), ("messiah", "prophet"),
    ("debate", "debate"), ("council", "debate"), ("assembly", "debate"), ("summit", "debate"),
    ("senate", "debate"), ("parliament", "debate"),
    ("appeal", "appeal"), ("petition", "appeal"), ("scholar", "appeal"), ("academy", "appeal"),
    ("statue", "statue"), ("monument", "statue"), ("memorial", "statue"),
    ("anomaly", "anomaly"), ("paradox", "anomaly"),
    ("astronomer", "astronomer"), ("observatory", "astronomer"), ("telescope", "astronomer"),
    ("archive", "archives"), ("library", "archives"), ("record", "archives"), ("vault", "archives"),
    ("mine", "mine"), ("collapse", "mine"), ("tunnel", "mine"),
    ("rail", "rail"), ("train", "rail"), ("convoy", "rail"), ("locomotive", "rail"),
    ("generation_ship", "generation_ship"), ("ark", "generation_ship"), ("fleet", "generation_ship"),
    ("ship", "generation_ship"),
    ("probe", "deep_probe"), ("satellite", "deep_probe"),
    ("listening", "listening"), ("signal", "listening"), ("radio", "listening"), ("antenna", "listening"),
    ("flare", "solar_flare"), ("solar", "solar_flare"), ("aurora", "solar_flare"),
    ("meteor", "meteor"), ("impact", "meteor"), ("asteroid", "meteor"), ("comet", "meteor"), ("crater", "meteor"),
    ("factory", "factory"), ("industry", "factory"), ("forge", "factory"), ("smelter", "factory"),
    ("lab", "lab"), ("experiment", "lab"), ("reactor", "lab"), ("research", "lab"),
    ("ruin", "ruins"), ("wreck", "ruins"), ("debris", "ruins"),
]

PREFIX_FALLBACK = {
    "env": "dawn", "soc": "crowd", "pol": "debate", "sci": "anomaly", "ind": "factory",
    "spc": "generation_ship", "mys": "listening", "haz": "meteor", "mil": "ruins",
    "econ": "factory", "tech": "lab", "cul": "cult", "exp": "map",
}


def scene_for(eid):
    low = eid.lower()
    for kw, name in KEYWORDS:
        if kw in low:
            return name
    prefix = low.split("_")[0]
    return PREFIX_FALLBACK.get(prefix, "map")


def render_one(eid, path):
    seed = seed_for(eid)
    a = Art(seed)
    scene_name = scene_for(eid)
    SCENES[scene_name](a)
    annotations(a, seed)
    plate_frame(a, seed)
    a.finish(path)
    return seed, scene_name


# ----------------------------------------------------------------------------
# 预览拼版
# ----------------------------------------------------------------------------
def contact_sheet(out_dir, cols=6, thumb_w=252, thumb_h=142, pad=10, label_h=18):
    names = sorted([f for f in os.listdir(out_dir)
                    if f.endswith(".jpg") and not f.startswith("_")])
    if not names:
        return None
    rows = (len(names) + cols - 1) // cols
    sheet_w = cols * (thumb_w + pad) + pad
    sheet_h = rows * (thumb_h + label_h + pad) + pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (28, 28, 28))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=13)
    except Exception:
        font = ImageFont.load_default()
    for i, name in enumerate(names):
        c, r = i % cols, i // cols
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + label_h + pad)
        try:
            im = Image.open(os.path.join(out_dir, name)).convert("RGB")
            im = im.resize((thumb_w, thumb_h), Image.LANCZOS)
            sheet.paste(im, (x, y))
        except Exception:
            continue
        draw.text((x, y + thumb_h + 3), name[:-4], fill=(200, 200, 200), font=font)
    path = os.path.join(out_dir, "_contact-sheet.jpg")
    sheet.save(path, "JPEG", quality=84, optimize=True, progressive=True)
    return path


# ----------------------------------------------------------------------------
# 定义文件解析 / 资产清单
# ----------------------------------------------------------------------------
def parse_defs(path):
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            txt = f.read()
    except OSError:
        return []
    seen = []
    for m in ID_RE.finditer(txt):
        eid = m.group(1)
        if eid in seen:
            continue
        if EVENT_ID_RE.match(eid):
            seen.append(eid)
    return seen


PRINT_USAGE = {
    "hatch-45.svg": ("印刷装饰：45° 排线平铺底纹", 32, 32),
    "dot-matrix.svg": ("印刷装饰：点阵平铺底纹", 24, 24),
    "registration-strip.svg": ("印刷装饰：CMYK 套准色条 + 刻度尺", 320, 28),
    "line-art-corners.svg": ("印刷装饰：版画线稿角标（旋转/镜像复用四角）", 128, 128),
    "loading-lineart.svg": ("加载页线稿：三恒星观测台（深色背景版）", 1200, 675),
    "grain.png": ("印刷颗粒：纸面/胶片噪点叠加层", 256, 256),
}


def _svg_size(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            head = f.read(900)
        mw = re.search(r'width="([\d.]+)"', head)
        mh = re.search(r'height="([\d.]+)"', head)
        if mw and mh:
            return int(float(mw.group(1))), int(float(mh.group(1)))
    except OSError:
        pass
    return 0, 0


def _dims(path):
    try:
        with Image.open(path) as im:
            return im.size
    except Exception:
        return (0, 0)


def build_manifest(out_dir, manifest_path):
    items = []
    # 1) 印刷装饰包
    for name, (usage, dw, dh) in sorted(PRINT_USAGE.items()):
        path = os.path.join(PRINT_DIR, name)
        if not os.path.isfile(path):
            continue
        w, h = (dw, dh) if name.endswith(".svg") else _dims(path)
        if name.endswith(".svg"):
            w, h = _svg_size(path) or (dw, dh)
        items.append({
            "path": "public/print/" + name,
            "kind": "print-decoration",
            "format": os.path.splitext(name)[1].lstrip("."),
            "width": w, "height": h,
            "bytes": os.path.getsize(path),
            "source": "procedural",
            "tool": "hand-authored SVG" if name.endswith(".svg") else "python-pillow",
            "usage": usage,
        })
    # 2) 即梦 hero 大图
    meta_path = os.path.join(HERO_DIR, "hero-meta.json")
    hero_meta = {}
    if os.path.isfile(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                for row in json.load(f).get("heroes", []):
                    hero_meta[row["file"]] = row
        except Exception:
            hero_meta = {}
    if os.path.isdir(HERO_DIR):
        for name in sorted(os.listdir(HERO_DIR)):
            if not name.lower().endswith((".jpg", ".png")):
                continue
            path = os.path.join(HERO_DIR, name)
            w, h = _dims(path)
            meta = hero_meta.get(name, {})
            item = {
                "path": "public/images/v13/" + name,
                "kind": "hero-illustration",
                "format": os.path.splitext(name)[1].lstrip("."),
                "width": w, "height": h,
                "bytes": os.path.getsize(path),
                "source": "jimeng",
                "tool": "即梦AI Seedream 5.5（网页版，Win32 窗口自动化）",
                "usage": meta.get("usage", "关键事件链 hero 大图（事件/结局面板）"),
                "prompt": meta.get("prompt", ""),
                "watermark": True,
                "license": "AI 生成（用户账号生成，随包仅用于本项目）",
            }
            items.append(item)
    # 3) 随机事件插图
    if os.path.isdir(out_dir):
        for name in sorted(os.listdir(out_dir)):
            if not name.lower().endswith(".jpg") or name.startswith("_"):
                continue
            path = os.path.join(out_dir, name)
            eid = os.path.splitext(name)[0]
            w, h = _dims(path)
            items.append({
                "path": "public/events/" + name,
                "kind": "event-illustration",
                "format": "jpg",
                "width": w, "height": h,
                "bytes": os.path.getsize(path),
                "source": "procedural",
                "tool": "python-pillow (scripts/gen-event-art.py)",
                "seed": seed_for(eid),
                "scene": scene_for(eid),
                "usage": "随机事件「%s」插图（事件弹窗主图 / 事件历史）" % eid,
            })
    contact = os.path.join(out_dir, "_contact-sheet.jpg")
    if os.path.isfile(contact):
        items.append({
            "path": "public/events/_contact-sheet.jpg",
            "kind": "documentation",
            "format": "jpg",
            "width": _dims(contact)[0], "height": _dims(contact)[1],
            "bytes": os.path.getsize(contact),
            "source": "procedural",
            "tool": "python-pillow (scripts/gen-event-art.py --contact-sheet)",
            "usage": "全部事件插图预览拼版（文档用，游戏不引用）",
        })
    counts = {"total": len(items)}
    for it in items:
        counts[it["kind"]] = counts.get(it["kind"], 0) + 1
    manifest = {
        "version": "v3",
        "project": "三体纪元 TRISOLARIS: CIVILIZATION",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "style": "终端工业画册 / 版画线稿：米白纸底 + 墨黑线稿 + 极少量信号黄，16:9",
        "palette": {"paper": "#F4F1EA", "ink": "#111111", "signalYellow": "#FDFD1F"},
        "counts": counts,
        "items": items,
    }
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return manifest


# ----------------------------------------------------------------------------
# 入口
# ----------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description="三体纪元 v1.3 随机事件插图生成器（工业画册 / 版画线稿）")
    ap.add_argument("--defs", default=DEFS_DEFAULT, help="事件定义文件（默认 src/events/definitions.ts）")
    ap.add_argument("--out", default=OUT_DEFAULT, help="事件插图输出目录（默认 public/events）")
    ap.add_argument("--manifest", default=MANIFEST_DEFAULT, help="资产清单输出路径")
    ap.add_argument("--force", action="store_true", help="覆盖已有插图")
    ap.add_argument("--only", default="", help="只处理这些 id（逗号分隔）")
    ap.add_argument("--ids", default="", help="不读定义文件，直接生成这些 id（逗号分隔）")
    ap.add_argument("--limit", type=int, default=0, help="最多生成 N 张（调试）")
    ap.add_argument("--manifest-only", action="store_true", help="只重建资产清单")
    ap.add_argument("--contact-sheet", action="store_true", help="额外生成预览拼版")
    ap.add_argument("--polish-only", action="store_true", help="只对已有插图做锐化/对比微调（不重绘）")
    args = ap.parse_args(argv)

    if args.ids.strip():
        ids = [s for s in re.split(r"[,\s]+", args.ids.strip()) if s]
    else:
        ids = parse_defs(args.defs)
        if not ids:
            print("警告：未在 %s 中发现事件 id（文件可能尚未落盘），可先用 --ids 指定。" % args.defs)
    if args.only.strip():
        only = set(s for s in re.split(r"[,\s]+", args.only.strip()) if s)
        ids = [i for i in ids if i in only]
    if args.limit > 0:
        ids = ids[:args.limit]

    print("事件 id：%d 个" % len(ids))
    if args.polish_only:
        n = 0
        for eid in ids:
            path = os.path.join(args.out, eid + ".jpg")
            if not os.path.isfile(path):
                continue
            with Image.open(path) as im:
                polish(im.convert("RGB")).save(path, "JPEG", quality=89, optimize=True, progressive=True)
            n += 1
        print("微调 %d 张" % n)
        args.manifest_only = True
    made = skipped = 0
    if not args.manifest_only:
        os.makedirs(args.out, exist_ok=True)
        for eid in ids:
            path = os.path.join(args.out, eid + ".jpg")
            if os.path.isfile(path) and not args.force:
                skipped += 1
                continue
            t0 = time.time()
            seed, scene_name = render_one(eid, path)
            made += 1
            print("  + %-28s scene=%-15s seed=%016x  %.2fs  %d B" % (
                eid, scene_name, seed, time.time() - t0, os.path.getsize(path)))
        print("生成 %d 张，跳过 %d 张" % (made, skipped))

    manifest = build_manifest(args.out, args.manifest)
    print("清单 -> %s（共 %d 项）" % (args.manifest, manifest["counts"]["total"]))

    if args.contact_sheet:
        p = contact_sheet(args.out)
        if p:
            print("拼版 -> %s" % p)
    return 0


if __name__ == "__main__":
    sys.exit(main())

    a.line([(300, 700), (460, 700)], 1.0, 0.5)
    a.line([(460, 700), (460, 620)], 0.9, 0.45)
    a.circle(460, 614, 7, 1.0, 0.6)
    # 工程测量标
    a.crossesquare(1250, 660, 12, 0.3, 1.0)
    a.dashed([(1250, 660), (1080, 520)], 12, 10, 0.7, 0.2)
    # 黄：引擎喷口
    a.yfill([(252, 380), (300, 370), (300, 430), (252, 424)], 0.75)
    a.line([(304, 400), (360, 400)], 1.4, 0.35)
