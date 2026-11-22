#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""《三体纪元》v1.4 四天体高清贴图生成器 —— 全部程序化（numpy + Pillow），无任何外部素材

对应 docs/V4_SPEC.md §4.1（task-21）。产物：

  public/textures/star-a.jpg          恒星 A（G 型 · 银白/暖白）    2048x1024 equirect
  public/textures/star-b.jpg          恒星 B（A 型 · 蓝白）          2048x1024 equirect
  public/textures/star-c.jpg          恒星 C（K/M 型 · 橙红）        2048x1024 equirect
  public/textures/planet-day.jpg      母星昼面（海洋/大陆/海岸/冰盖）2048x1024 equirect
  public/textures/planet-clouds.png   透明云层（RGBA，白/灰白）     2048x1024 equirect
  public/textures/planet-night.jpg    夜面城市灯光（黑底暖黄）      2048x1024 equirect
  public/textures/planet-normal.jpg   可选：切线空间法线（地形起伏） 2048x1024 equirect
  public/textures/planet-water-mask.jpg 可选：海陆遮罩（白=水，供海洋高光）
  public/textures/manifest.json       机器可读清单（尺寸/字节/sha256/用途/无缝校验）
  public/textures/preview/*.jpg       球体预览、近景、接触表、接缝核对图

约定：
  * 等距圆柱（equirectangular）：u = 经度/2π 向右，v: 图像顶行 = 北纬 90°，图像底行 = 南纬 90°；
  * 横向周期：噪声在经度方向严格周期，左右边缘可平铺（THREE.RepeatWrapping）；
  * 全部由固定 seed 决定，可复现；不含下载/第三方素材。

用法（项目根目录）：
  python scripts/gen-planet-textures.py                 # 生成全部 + 预览 + manifest + 自检
  python scripts/gen-planet-textures.py --seed 20261121
  python scripts/gen-planet-textures.py --size 4096     # 可选高清档（H = size/2）
  python scripts/gen-planet-textures.py --only star-a,planet
  python scripts/gen-planet-textures.py --no-preview    # 只出贴图
  python scripts/gen-planet-textures.py --preview-only  # 只按磁盘上已有贴图重出预览/校验

注意：Windows 上推荐使用项目内置 Python（含 numpy/Pillow）：
  %USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe
"""
import argparse
import hashlib
import json
import math
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PY = np.float32
PI = math.pi
TAU = math.tau

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "textures")
PREV_DIR = os.path.join(OUT_DIR, "preview")
DEFAULT_SEED = 20261121

# 全图目标：行星陆地占比 / 云量
LAND_FRACTION = 0.335

# ---------------------------------------------------------------- 通用工具


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def rgb(v):
    return np.array(v, dtype=np.float32)


def make_lut(stops):
    """stops: [(pos, (r,g,b)), ...] -> (256,3) float32 查找表（缓动线性插值）。"""
    xs = np.linspace(0.0, 1.0, 256, dtype=np.float32)
    pos = np.array([s[0] for s in stops], dtype=np.float32)
    cols = [np.array([s[1][c] for s in stops], dtype=np.float32) for c in range(3)]
    return np.stack([np.interp(xs, pos, c) for c in cols], axis=-1).astype(np.float32)


def lut_map(lut, t):
    idx = np.clip(t * PY(255.0), 0.0, 255.0).astype(np.uint8)
    return lut[idx]


def sample_lut2d(lut, x, y):
    """lut: (n,n,3)，x=湿润度 0..1，y=温度 0..1（双线性）。"""
    n = lut.shape[0] - 1
    fx = np.clip(x, 0.0, 1.0) * n
    fy = np.clip(y, 0.0, 1.0) * n
    x0f = np.floor(fx)
    y0f = np.floor(fy)
    x0 = x0f.astype(np.int32)
    y0 = y0f.astype(np.int32)
    tx = (fx - x0f).astype(np.float32)
    ty = (fy - y0f).astype(np.float32)
    x1 = np.minimum(x0 + 1, n)
    y1 = np.minimum(y0 + 1, n)
    c00 = lut[y0, x0]
    c10 = lut[y0, x1]
    c01 = lut[y1, x0]
    c11 = lut[y1, x1]
    top = c00 + (c10 - c00) * tx[..., None]
    bot = c01 + (c11 - c01) * tx[..., None]
    return top + (bot - top) * ty[..., None]


def gauss_blur(arr, radius):
    """float01 单通道 -> 高斯模糊（借助 Pillow C 实现）。"""
    u8 = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    img = Image.fromarray(u8, mode="L").filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, dtype=np.float32) / 255.0


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)


def load_rgba(path):
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32)


def save_jpg(arr, path, quality=90, subsampling=0):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode="RGB")
    img.save(path, format="JPEG", quality=quality, subsampling=subsampling,
             optimize=True, progressive=True)


# ---------------------------------------------------------------- 噪声核心：3D 球面


def _hash32(ix, iy, iz, seed):
    with np.errstate(over="ignore", invalid="ignore"):
        h = ix.astype(np.uint32) * np.uint32(0x8DA6B343)
        h = h ^ (iy.astype(np.uint32) * np.uint32(0xD8163841))
        h = h ^ (iz.astype(np.uint32) * np.uint32(0xCB1AB31F))
        h = h ^ np.uint32(seed & 0xFFFFFFFF)
        h = h ^ (h >> 13)
        h = h * np.uint32(0x5BD1E995)
        h = h ^ (h >> 15)
    return h


def _hunit(ix, iy, iz, seed):
    return (_hash32(ix, iy, iz, seed) & np.uint32(0x00FFFFFF)).astype(np.float32) * PY(1.0 / 16777216.0)


def _hash32_2d(ix, iy, seed):
    with np.errstate(over="ignore", invalid="ignore"):
        h = ix.astype(np.uint32) * np.uint32(0x8DA6B343)
        h = h ^ (iy.astype(np.uint32) * np.uint32(0xD8163841))
        h = h ^ np.uint32(seed & 0xFFFFFFFF)
        h = h ^ (h >> 13)
        h = h * np.uint32(0x5BD1E995)
        h = h ^ (h >> 15)
    return h


def _hunit2(ix, iy, seed):
    return (_hash32_2d(ix, iy, seed) & np.uint32(0x00FFFFFF)).astype(np.float32) * PY(1.0 / 16777216.0)


def value_noise3(px, py, pz, freq, seed):
    """3D 值噪声：输入单位球方向（px,py,pz），天然无接缝、无极点。"""
    x = px * PY(freq)
    y = py * PY(freq)
    z = pz * PY(freq)
    xf = np.floor(x)
    yf = np.floor(y)
    zf = np.floor(z)
    xi = xf.astype(np.int32)
    yi = yf.astype(np.int32)
    zi = zf.astype(np.int32)
    fx = (x - xf).astype(np.float32)
    fy = (y - yf).astype(np.float32)
    fz = (z - zf).astype(np.float32)
    u = fx * fx * fx * (fx * (fx * PY(6.0) - PY(15.0)) + PY(10.0))
    v = fy * fy * fy * (fy * (fy * PY(6.0) - PY(15.0)) + PY(10.0))
    w = fz * fz * fz * (fz * (fz * PY(6.0) - PY(15.0)) + PY(10.0))
    h000 = _hunit(xi, yi, zi, seed)
    h100 = _hunit(xi + 1, yi, zi, seed)
    h010 = _hunit(xi, yi + 1, zi, seed)
    h110 = _hunit(xi + 1, yi + 1, zi, seed)
    h001 = _hunit(xi, yi, zi + 1, seed)
    h101 = _hunit(xi + 1, yi, zi + 1, seed)
    h011 = _hunit(xi, yi + 1, zi + 1, seed)
    h111 = _hunit(xi + 1, yi + 1, zi + 1, seed)
    x00 = h000 + (h100 - h000) * u
    x10 = h010 + (h110 - h010) * u
    x01 = h001 + (h101 - h001) * u
    x11 = h011 + (h111 - h011) * u
    y0 = x00 + (x10 - x00) * v
    y1 = x01 + (x11 - x01) * v
    return y0 + (y1 - y0) * w


def fbm3(px, py, pz, octaves, base, seed, gain=0.5, ridged=False):
    total = np.zeros(px.shape, np.float32)
    amp = PY(1.0)
    norm = PY(0.0)
    freq = float(base)
    for o in range(octaves):
        n = value_noise3(px + PY(7.13 * o), py + PY(-3.71 * o), pz + PY(5.29 * o),
                         freq, (seed + 7919 * o) & 0xFFFFFFFF)
        if ridged:
            n = PY(1.0) - np.abs(n * PY(2.0) - PY(1.0))
        total += n * amp
        norm += amp
        amp *= PY(gain)
        freq *= 2.0
    return total / norm


def worley_scaled(x, y, z, seed):
    """Worley（F1/F2）在已缩放的坐标上求值（便于域扭曲），单位与格点一致。"""
    xi = np.floor(x).astype(np.int32)
    yi = np.floor(y).astype(np.int32)
    zi = np.floor(z).astype(np.int32)
    f1 = np.full(x.shape, PY(9.0), np.float32)
    f2 = np.full(x.shape, PY(9.0), np.float32)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                cx = xi + dx
                cy = yi + dy
                cz = zi + dz
                h = _hash32(cx, cy, cz, seed)
                jx = (h & np.uint32(0x3FF)).astype(np.float32) * PY(0.8 / 1023.0) + PY(0.1)
                jy = ((h >> 10) & np.uint32(0x3FF)).astype(np.float32) * PY(0.8 / 1023.0) + PY(0.1)
                jz = ((h >> 20) & np.uint32(0x3FF)).astype(np.float32) * PY(0.8 / 1023.0) + PY(0.1)
                ddx = (cx.astype(np.float32) + jx) - x
                ddy = (cy.astype(np.float32) + jy) - y
                ddz = (cz.astype(np.float32) + jz) - z
                d2 = ddx * ddx + ddy * ddy + ddz * ddz
                m1 = d2 < f1
                f2 = np.where(m1, f1, f2)
                f1 = np.where(m1, d2, f1)
                m2 = (d2 < f2) & (~m1)
                f2 = np.where(m2, d2, f2)
    return np.sqrt(f1), np.sqrt(f2)


def worley_sphere(px, py, pz, freq, seed):
    """球面 Worley（F1/F2），返回 (f1,f2) —— 用于恒星光球米粒组织。"""
    x = px * PY(freq)
    y = py * PY(freq)
    z = pz * PY(freq)
    return worley_scaled(x, y, z, seed)


# ---------------------------------------------------------------- 噪声核心：2D 经度周期


def value_noise2(u, v, nx, ny, seed):
    """2D 值噪声：u 方向严格周期（整数格点 nx 回绕），v 不周期。"""
    x = u * PY(nx)
    y = v * PY(ny)
    xf = np.floor(x)
    yf = np.floor(y)
    fx = (x - xf).astype(np.float32)
    fy = (y - yf).astype(np.float32)
    x0 = xf.astype(np.int32)
    y0 = yf.astype(np.int32)
    x0 = x0 % nx
    x1 = (x0 + 1) % nx
    y1 = y0 + 1
    u5 = fx * fx * fx * (fx * (fx * PY(6.0) - PY(15.0)) + PY(10.0))
    v5 = fy * fy * fy * (fy * (fy * PY(6.0) - PY(15.0)) + PY(10.0))
    h00 = _hunit2(x0, y0, seed)
    h10 = _hunit2(x1, y0, seed)
    h01 = _hunit2(x0, y1, seed)
    h11 = _hunit2(x1, y1, seed)
    top = h00 + (h10 - h00) * u5
    bot = h01 + (h11 - h01) * u5
    return top + (bot - top) * v5


def fbm2(u, v, octaves, base, seed, gain=0.5, ny_ratio=0.5, ridged=False):
    """2D fBm，经度方向无缝。base = 经度方向格点数的基准值。"""
    total = np.zeros(u.shape, np.float32)
    amp = PY(1.0)
    norm = PY(0.0)
    nx = max(1, int(round(base)))
    for o in range(octaves):
        ny = max(1, int(round(nx * ny_ratio)))
        n = value_noise2(u + PY(0.317 * o), v + PY(0.713 * o), nx, ny,
                         (seed + 7919 * o) & 0xFFFFFFFF)
        if ridged:
            n = PY(1.0) - np.abs(n * PY(2.0) - PY(1.0))
        total += n * amp
        norm += amp
        amp *= PY(gain)
        nx *= 2
    return total / norm


def resize_wrap(field, W, H):
    """低分辨率（x 方向周期）场双线性放大到 (H,W)，x 方向回绕、y 方向夹取。"""
    Hl, Wl = field.shape
    xs = ((np.arange(W, dtype=np.float32) + 0.5) * (Wl / W) - 0.5).astype(np.float32)
    ys = ((np.arange(H, dtype=np.float32) + 0.5) * (Hl / H) - 0.5).astype(np.float32)
    x0f = np.floor(xs)
    y0f = np.floor(ys)
    tx = (xs - x0f).astype(np.float32)
    ty = (ys - y0f).astype(np.float32)
    x0 = x0f.astype(np.int32) % Wl
    x1 = (x0 + 1) % Wl
    y0 = np.clip(y0f.astype(np.int32), 0, Hl - 1)
    y1 = np.clip(y0 + 1, 0, Hl - 1)
    r0 = field[y0]
    r1 = field[y1]
    top = r0[:, x0] * (1.0 - tx) + r0[:, x1] * tx
    bot = r1[:, x0] * (1.0 - tx) + r1[:, x1] * tx
    return top * (1.0 - ty)[:, None] + bot * ty[:, None]


# ---------------------------------------------------------------- 网格


def build_grid(W, H):
    lon = ((np.arange(W, dtype=np.float32) + 0.5) / W * PY(TAU)).astype(np.float32)
    lat = ((PY(0.5) - (np.arange(H, dtype=np.float32) + 0.5) / H) * PY(PI)).astype(np.float32)
    LON, LAT = np.meshgrid(lon, lat)
    grid = {
        "W": W, "H": H,
        "lon": LON, "lat": LAT,
        "u": (LON / PY(TAU)).astype(np.float32),
        "v": (LAT / PY(PI) + PY(0.5)).astype(np.float32),
        "px": (np.cos(LAT) * np.cos(LON)).astype(np.float32),
        "py": (np.cos(LAT) * np.sin(LON)).astype(np.float32),
        "pz": np.sin(LAT).astype(np.float32),
        "latn": (np.abs(LAT) / PY(PI * 0.5)).astype(np.float32),
        "lat_deg": (LAT * PY(180.0 / PI)).astype(np.float32),
    }
    return grid


def lowres_grid(W, H, f=2):
    Wl, Hl = max(2, W // f), max(2, H // f)
    lon = ((np.arange(Wl, dtype=np.float32) + 0.5) / Wl * PY(TAU)).astype(np.float32)
    lat = ((PY(0.5) - (np.arange(Hl, dtype=np.float32) + 0.5) / Hl) * PY(PI)).astype(np.float32)
    LON, LAT = np.meshgrid(lon, lat)
    g = {
        "W": Wl, "H": Hl, "lon": LON, "lat": LAT,
        "px": (np.cos(LAT) * np.cos(LON)).astype(np.float32),
        "py": (np.cos(LAT) * np.sin(LON)).astype(np.float32),
        "pz": np.sin(LAT).astype(np.float32),
    }
    return g


def unit_dir(lon, lat):
    cl = math.cos(lat)
    return np.array([cl * math.cos(lon), cl * math.sin(lon), math.sin(lat)], dtype=np.float32)


def rot_tangent(c, angle, amp):
    """把单位向量 c 沿切平面旋转一个小角度。"""
    up = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    if abs(float(c[2])) > 0.94:
        up = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    t = np.cross(c, up)
    t = t / np.linalg.norm(t)
    out = c * PY(math.cos(amp)) + t * PY(math.sin(amp) * angle)
    return out / np.linalg.norm(out)


# ---------------------------------------------------------------- 恒星


STAR_CFGS = {
    "star-a": {
        "name": "恒星 A", "name_en": "STAR A", "spectral": "G 型 · 银白/暖白",
        "palette": [(0.00, (206, 178, 134)), (0.40, (226, 208, 176)),
                    (0.70, (238, 228, 206)), (1.00, (248, 240, 224))],
        "spot": (74, 48, 28), "facula": (254, 250, 240),
        "flare": (255, 246, 214), "flare_hot": (255, 236, 196),
        "brightness": 0.99, "contrast": 1.28, "gran_freq": 26.0, "med_freq": 34.0, "hi_freq": 110.0,
        "n_regions": 3, "spots_per_region": (2, 4), "radius": (0.022, 0.085),
        "n_flares": 2, "spot_activity": 1.0, "flare_rad": (0.018, 0.032), "flare_amp": (0.55, 1.0),
    },
    "star-b": {
        "name": "恒星 B", "name_en": "STAR B", "spectral": "A 型 · 蓝白",
        "palette": [(0.00, (118, 148, 204)), (0.40, (172, 200, 242)),
                    (0.70, (212, 232, 250)), (1.00, (242, 249, 255))],
        "spot": (52, 66, 104), "facula": (254, 254, 255),
        "flare": (236, 247, 255), "flare_hot": (200, 228, 255),
        "brightness": 1.01, "contrast": 1.50, "gran_freq": 30.0, "med_freq": 38.0, "hi_freq": 120.0,
        "n_regions": 2, "spots_per_region": (2, 3), "radius": (0.018, 0.070),
        "n_flares": 3, "spot_activity": 0.85, "flare_rad": (0.013, 0.024), "flare_amp": (0.38, 0.62),
    },
    "star-c": {
        "name": "恒星 C", "name_en": "STAR C", "spectral": "K/M 型 · 橙红",
        "palette": [(0.00, (198, 96, 44)), (0.40, (224, 140, 64)),
                    (0.70, (238, 176, 100)), (1.00, (250, 210, 154))],
        "spot": (88, 28, 10), "facula": (255, 228, 180),
        "flare": (255, 198, 112), "flare_hot": (255, 170, 78),
        "brightness": 0.99, "contrast": 1.00, "gran_freq": 22.0, "med_freq": 30.0, "hi_freq": 96.0,
        "n_regions": 4, "spots_per_region": (2, 4), "radius": (0.028, 0.110),
        "n_flares": 2, "spot_activity": 1.25, "flare_rad": (0.020, 0.038), "flare_amp": (0.70, 1.15),
    },
}


def star_spots(grid, rng, cfg):
    """生成黑子活动区（不规则本影+半影）与光斑，返回 (spot_mix, fac, regions)。"""
    px, py, pz = grid["px"], grid["py"], grid["pz"]
    H, W = px.shape
    med = cfg["_med"]
    hi = cfg["_hi"]
    spot_mix = np.zeros((H, W), np.float32)
    fac = np.zeros((H, W), np.float32)
    regions = []
    n_regions = cfg["n_regions"]
    lon0 = float(rng.uniform(0.0, TAU))
    for i in range(n_regions):
        lon = float((lon0 + TAU * i / n_regions + rng.normal(0.0, 0.5)) % TAU)
        lat = float(rng.uniform(-0.62, 0.62))
        if abs(lat) < 0.10:
            lat = 0.12 * (1.0 if lat >= 0 else -1.0)
        regions.append((lon, lat))
        c = unit_dir(lon, lat)
        n_spots = int(rng.integers(cfg["spots_per_region"][0], cfg["spots_per_region"][1] + 1))
        for _ in range(n_spots):
            off = float(rng.uniform(0.0, 0.115))
            ang = float(rng.uniform(0.0, TAU))
            sc = rot_tangent(c, ang, off)
            radius = float(np.exp(rng.uniform(math.log(cfg["radius"][0]), math.log(cfg["radius"][1]))))
            strength = float(rng.uniform(0.72, 1.0)) * cfg["spot_activity"]
            cx, cy, cz = sc
            dot = px * cx + py * cy + pz * cz
            d2 = np.maximum(PY(2.0) - PY(2.0) * dot, PY(0.0))
            rc = PY(2.0 * math.sin(radius * 0.5))
            t = np.sqrt(d2) / rc + (med - PY(0.5)) * PY(0.42) + (hi - PY(0.5)) * PY(0.16)
            umbra = PY(1.0) - smoothstep(PY(0.33), PY(0.52), t + PY(0.03) * (med - PY(0.5)))
            pen = np.clip((PY(1.0) - smoothstep(PY(0.82), PY(1.14), t)) - umbra, 0.0, 1.0)
            pen = pen * (PY(0.50) + PY(0.70) * hi)
            mix = np.clip((PY(0.95) * umbra + PY(0.48) * pen) * PY(min(strength, 1.15)), 0.0, 1.0)
            np.maximum(spot_mix, mix, out=spot_mix)
            fr = (smoothstep(PY(1.00), PY(1.16), t) *
                  (PY(1.0) - smoothstep(PY(1.42), PY(1.85), t)) *
                  (PY(0.30) + PY(0.90) * med) * PY(min(strength, 1.1)))
            np.maximum(fac, np.clip(fr, 0.0, 1.0), out=fac)
    return spot_mix, fac, regions


def star_flares(grid, rng, cfg, regions):
    """耀斑环：低分辨率求值后双线性放大（辉光平滑，足够）。"""
    lo = lowres_grid(grid["W"], grid["H"], 2)
    x, y, z = lo["px"], lo["py"], lo["pz"]
    field = np.zeros(x.shape, np.float32)
    if not regions:
        return np.zeros((grid["H"], grid["W"]), np.float32)
    n_flares = cfg["n_flares"]
    for i in range(n_flares):
        lon, lat = regions[i % len(regions)]
        p1 = unit_dir(lon, lat)
        ang = float(rng.uniform(0.0, TAU))
        sep = float(rng.uniform(0.10, 0.22))
        p2 = rot_tangent(p1, ang, sep)
        h = float(rng.uniform(0.14, 0.28))
        mid = (p1 + p2)
        mid = mid / np.linalg.norm(mid)
        ctrl = mid * PY(1.0 + h)
        rad = float(rng.uniform(*cfg.get("flare_rad", (0.014, 0.026))))
        amp = float(rng.uniform(*cfg.get("flare_amp", (0.55, 1.0))))
        phase = float(rng.uniform(0.0, TAU))
        n_beads = 26
        for k in range(n_beads):
            s = k / (n_beads - 1.0)
            pos = (p1 * PY((1 - s) ** 2) + ctrl * PY(2.0 * (1 - s) * s) + p2 * PY(s * s))
            pos = pos / np.linalg.norm(pos)
            w = amp * (0.45 + 0.55 * math.sin(math.pi * s)) * (0.78 + 0.22 * math.cos(2.1 * k + phase))
            dot = x * pos[0] + y * pos[1] + z * pos[2]
            d2 = np.maximum(PY(2.0) - PY(2.0) * dot, PY(0.0))
            field += w * np.exp(-d2 / PY(2.0 * rad * rad)).astype(np.float32)
    return resize_wrap(field, grid["W"], grid["H"])


def gen_star(key, grid, seed, W, H):
    cfg = dict(STAR_CFGS[key])
    rng = np.random.default_rng(seed)
    px, py, pz = grid["px"], grid["py"], grid["pz"]
    t0 = time.time()
    # 大尺度温度起伏 / 超米粒组织 / 中等湍流 / 细纹理
    temp = fbm3(px, py, pz, 3, 2.6, seed + 17)
    superg = fbm3(px, py, pz, 3, 5.2, seed + 23)
    med = fbm3(px, py, pz, 3, cfg["med_freq"], seed + 31)
    hi = fbm3(px, py, pz, 2, cfg["hi_freq"], seed + 37)
    cfg["_med"] = med
    cfg["_hi"] = hi
    # 米粒组织：域扭曲 Worley —— 亮米粒内部 + 细暗米粒间通道（非“气泡”式径向渐变）
    fq = PY(cfg["gran_freq"])
    wx = px * fq + PY(1.05) * (med - PY(0.5)) + PY(0.45) * (temp - PY(0.5))
    wy = py * fq + PY(1.05) * (hi - PY(0.5)) + PY(0.45) * (superg - PY(0.5))
    wz = pz * fq + PY(1.05) * (superg - PY(0.5)) + PY(0.45) * (med - PY(0.5))
    f1, f2 = worley_scaled(wx, wy, wz, seed + 41)
    lane_w = PY(0.14) + PY(0.06) * (med - PY(0.5))
    edge = smoothstep(PY(0.0), lane_w, f2 - f1)       # 1 = 米粒内部；0 = 米粒间暗通道
    interior = PY(1.0) - smoothstep(PY(0.10), PY(1.05), f1)
    g = PY(0.34) + PY(0.58) * edge + PY(0.08) * interior
    g = (g
         + PY(0.10) * (med - PY(0.5))
         + PY(0.075) * (superg - PY(0.5))
         + PY(0.065) * (hi - PY(0.5))
         + PY(0.04) * (temp - PY(0.5))
         + PY(0.05) * smoothstep(PY(0.82), PY(0.96), hi))
    g = np.clip(PY(0.5) + (g - PY(0.5)) * PY(cfg.get("contrast", 1.0)), 0.0, 1.0)
    lut = make_lut(cfg["palette"])
    t = np.clip((g - PY(0.20)) / PY(0.72), 0.0, 1.0)
    color = lut_map(lut, t)
    # 黑子 + 光斑
    spot_mix, fac, regions = star_spots(grid, rng, cfg)
    spot_col = rgb(cfg["spot"])[None, None, :]
    fac_col = rgb(cfg["facula"])[None, None, :]
    color = lerp(color, spot_col, spot_mix[..., None])
    color = lerp(color, fac_col, np.clip(fac, 0.0, 1.0)[..., None] * PY(0.55))
    # 耀斑
    flare = star_flares(grid, rng, cfg, regions)
    flare = np.clip(flare, 0.0, 1.5)
    color = color + flare[..., None] * rgb(cfg["flare"])[None, None, :] * PY(0.72)
    color = color + (flare ** PY(2.0))[..., None] * rgb(cfg["flare_hot"])[None, None, :] * PY(0.55)
    # 整体亮度
    color = color * PY(cfg["brightness"]) * (PY(0.97) + PY(0.06) * hi)[..., None]
    arr = np.clip(color, 0.0, 255.0).astype(np.uint8)
    path = os.path.join(OUT_DIR, key + ".jpg")
    save_jpg(arr, path, quality=90, subsampling=0)
    info = {
        "regions": regions,
        "lum": (arr.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)),
        "seconds": round(time.time() - t0, 1),
    }
    print("  [star] %-8s -> %s  %.1fs" % (key, os.path.basename(path), info["seconds"]))
    return info


# ---------------------------------------------------------------- 行星


# 气候-湿润度色板（Whittaker 风格 5x5，行=温度 冷->热，列=湿度 干->湿）
BIOME_LUT = np.array([
    [[228, 234, 240], [216, 224, 229], [202, 214, 218], [192, 206, 210], [184, 200, 204]],
    [[152, 140, 112], [126, 126, 100], [98, 116, 86], [66, 94, 66], [52, 82, 58]],
    [[178, 152, 102], [140, 132, 82], [110, 122, 68], [76, 106, 60], [60, 98, 56]],
    [[204, 172, 114], [176, 154, 90], [136, 136, 74], [90, 118, 62], [62, 104, 50]],
    [[220, 188, 128], [190, 162, 92], [154, 142, 72], [96, 114, 56], [40, 90, 42]],
], dtype=np.float32)

OCEAN_LUT = make_lut([
    (0.00, (66, 150, 146)),
    (0.12, (44, 124, 130)),
    (0.34, (28, 90, 120)),
    (0.62, (18, 60, 96)),
    (1.00, (10, 34, 62)),
])

ICE_COL = rgb((232, 238, 243))
SNOW_COL = rgb((240, 244, 248))
BEACH_COL = rgb((212, 196, 150))
ROCK_COL = rgb((122, 112, 100))
LAKE_COL = rgb((26, 78, 106))


def box_coast_proximity(land):
    """用模糊近似“离海岸/海的远近”：模糊后 0.5 附近为海岸线，1=内陆，0=深海。"""
    return gauss_blur(land, 5.0)


def gen_planet(grid, seed, W, H, quality):
    rng = np.random.default_rng(seed)
    u, v = grid["u"], grid["v"]
    lat_deg = grid["lat_deg"]
    latn = grid["latn"]
    t0 = time.time()
    print("  [planet] fields ...")
    # --- 域扭曲（塑造大陆轮廓）
    wu = fbm2(u, v, 4, 2, seed + 11) - PY(0.5)
    wv = fbm2(u, v, 4, 2, seed + 12) - PY(0.5)
    qu = u + PY(0.38) * wu
    qv = v + PY(0.24) * wv
    # --- 大陆高程
    e_lo = fbm2(qu, qv, 6, 3, seed + 21)
    e_hi = fbm2(u + PY(0.18) * wu, v + PY(0.12) * wv, 6, 6, seed + 22)
    e0 = PY(0.58) * e_lo + PY(0.42) * e_hi
    p2, p98 = np.percentile(e0, [2.0, 98.0])
    e0 = np.clip((e0 - p2) / max(float(p98 - p2), 1e-4), 0.0, 1.0).astype(np.float32)
    sea0 = float(np.quantile(e0, 1.0 - LAND_FRACTION))
    det = fbm2(u + PY(0.05) * wu, v, 5, 12, seed + 31)
    mtn = fbm2(qu, qv, 4, 7, seed + 32, ridged=True)
    mountain = mtn * smoothstep(sea0 - PY(0.02), sea0 + PY(0.10), e0)
    e = e0 + PY(0.055) * (det - PY(0.5)) + PY(0.11) * mountain
    sea = float(np.quantile(e, 1.0 - LAND_FRACTION))
    h = e - PY(sea)
    land = smoothstep(PY(-0.0028), PY(0.0028), h).astype(np.float32)
    # --- 湿度 / 温度
    mu = fbm2(u + PY(0.22) * wu, v + PY(0.10) * wv, 4, 4, seed + 41) - PY(0.5)
    mv = fbm2(u + PY(0.18) * wu, v + PY(0.12) * wv, 4, 4, seed + 42) - PY(0.5)
    mn = fbm2(u + PY(0.24) * mu, v + PY(0.18) * mv, 6, 3, seed + 43)
    moist = mn + PY(0.16) * np.exp(-(lat_deg / PY(9.0)) ** 2)
    moist = moist + PY(0.09) * np.exp(-((np.abs(lat_deg) - PY(52.0)) / PY(16.0)) ** 2)
    moist = moist - PY(0.20) * np.exp(-((np.abs(lat_deg) - PY(24.0)) / PY(12.0)) ** 2)
    coast = box_coast_proximity(land)
    moist = moist + PY(0.06) * coast
    moist = np.clip(PY(0.5) + (moist - PY(0.5)) * PY(1.22), 0.0, 1.0).astype(np.float32)
    temp = PY(1.0) - latn ** PY(1.42)
    temp = temp - PY(0.95) * np.maximum(h, 0.0) + PY(0.05) * (det - PY(0.5))
    temp = np.clip(temp, 0.0, 1.0).astype(np.float32)
    # --- 生物群系颜色
    land_col = sample_lut2d(BIOME_LUT, moist, temp)
    rock = smoothstep(PY(0.09), PY(0.24), h) * (PY(0.55) + PY(0.55) * (det - PY(0.5)))
    land_col = lerp(land_col, ROCK_COL[None, None, :], np.clip(rock, 0.0, 1.0)[..., None] * PY(0.85))
    snow_mtn = smoothstep(PY(0.30), PY(0.43), h) * smoothstep(PY(0.26), PY(0.08), temp)
    polar_n3 = fbm3(grid["px"], grid["py"], grid["pz"], 3, 7.0, seed + 71)   # 极点噪声走 3D，避免经度压缩拉丝
    polar = smoothstep(PY(0.795), PY(0.870), latn + PY(0.10) * (polar_n3 - PY(0.5)))
    land_col = lerp(land_col, SNOW_COL[None, None, :], np.clip(snow_mtn + polar, 0.0, 1.0)[..., None])
    beach = (PY(1.0) - smoothstep(PY(0.0), PY(0.010), h)) * land
    land_col = lerp(land_col, BEACH_COL[None, None, :], (beach * PY(0.8))[..., None])
    # --- 海洋颜色
    depth = np.clip(-h / PY(0.30), 0.0, 1.0)
    ocean = lut_map(OCEAN_LUT, depth)
    ocean = ocean * (PY(0.96) + PY(0.08) * det)[..., None]
    # --- 湖泊
    lake_n = fbm2(u + PY(0.10) * wu, v, 3, 18, seed + 51)
    lake_w = (smoothstep(PY(0.695), PY(0.735), lake_n) * land *
              smoothstep(PY(0.001), PY(0.004), h) * smoothstep(PY(0.20), PY(0.10), h))
    # --- 合成
    color = ocean * (PY(1.0) - land[..., None]) + land_col * land[..., None]
    color = lerp(color, LAKE_COL[None, None, :], np.clip(lake_w, 0.0, 1.0)[..., None] * PY(0.92))
    ice_col = ICE_COL[None, None, :] * (PY(0.965) + PY(0.07) * (polar_n3 - PY(0.5)))[..., None]
    color = lerp(color, ice_col, np.clip(polar, 0.0, 1.0)[..., None] * PY(0.97))
    # --- 细节噪声（近景可见，陆地更强）
    fine = fbm2(u, v, 3, 46, seed + 61)
    fine2 = fbm2(u, v, 2, 128, seed + 62)
    land_w = (PY(0.30) + PY(0.70) * land) * (PY(1.0) - PY(0.85) * polar)
    color = color * (PY(1.0) + PY(0.20) * (fine - PY(0.5)) * land_w + PY(0.07) * (fine2 - PY(0.5)) * (PY(1.0) - PY(0.75) * polar))[..., None]
    color = color * (PY(0.975) + PY(0.05) * (det - PY(0.5)))[..., None]
    # --- 烘焙轻微地形明暗（让近景陆地/山脉有起伏感；海洋近乎平坦）
    gx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)).astype(np.float32)
    gy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)).astype(np.float32)
    coslat = np.maximum(np.abs(np.cos(grid["lat"])), PY(0.25))
    nxh = -gx * PY(34.0) / coslat
    nyh = gy * PY(34.0)
    lxh, lyh, lzh = PY(-0.52), PY(0.60), PY(0.61)
    ln = np.sqrt(nxh * nxh + nyh * nyh + PY(1.0))
    shade = (nxh * lxh + nyh * lyh + lzh) / ln
    relief = PY(1.0) + (shade - PY(1.0)) * PY(0.65) * (PY(0.22) + PY(0.78) * land) * (PY(1.0) - PY(0.9) * polar)
    color = color * relief[..., None]
    day = np.clip(color, 0.0, 255.0).astype(np.uint8)
    save_jpg(day, os.path.join(OUT_DIR, "planet-day.jpg"), quality=quality, subsampling=0)
    print("    planet-day.jpg  %.1fs" % (time.time() - t0))
    # --- 云层
    t1 = time.time()
    cloud_alpha, cloud_rgb = gen_clouds(grid, seed + 101, W, H)
    rgba = np.dstack([cloud_rgb, cloud_alpha]).astype(np.uint8)
    Image.fromarray(rgba, mode="RGBA").save(os.path.join(OUT_DIR, "planet-clouds.png"),
                                             format="PNG", optimize=True, compress_level=9)
    print("    planet-clouds.png  %.1fs" % (time.time() - t1))
    # --- 夜面城市灯光
    t2 = time.time()
    night = gen_night(land, h, latn, coast, moist, seed + 201, W, H)
    save_jpg(night, os.path.join(OUT_DIR, "planet-night.jpg"), quality=quality, subsampling=0)
    print("    planet-night.jpg  %.1fs" % (time.time() - t2))
    # --- 海陆遮罩（可选，海洋高光用）
    water = np.clip(PY(1.0) - land, 0.0, 1.0)
    water = np.clip(water * PY(0.92) + PY(0.04), 0.0, 1.0)
    wm = np.repeat((water * 255.0).astype(np.uint8)[..., None], 3, axis=2)
    save_jpg(wm, os.path.join(OUT_DIR, "planet-water-mask.jpg"), quality=92, subsampling=0)
    # --- 法线贴图（可选，近景地形起伏）
    t3 = time.time()
    normal = gen_normal(h, land, grid)
    save_jpg(normal, os.path.join(OUT_DIR, "planet-normal.jpg"), quality=92, subsampling=0)
    print("    planet-normal.jpg  %.1fs" % (time.time() - t3))
    # 供预览使用：取一块海岸区域做近景
    coast_small = _downsample_frac(land, 8, 16)
    return {
        "seconds": round(time.time() - t0, 1),
        "coast_small": coast_small,
        "day": day,
    }


def _downsample_frac(mask, gh, gw):
    H, W = mask.shape
    return mask.reshape(gh, H // gh, gw, W // gw).mean(axis=(1, 3))


def gen_clouds(grid, seed, W, H):
    """云层：湍流 fBm + 气旋漩涡 + 微弱纬度环带；极区改用 3D 球面噪声避免经度压缩拉丝。"""
    u, v = grid["u"], grid["v"]
    px, py, pz = grid["px"], grid["py"], grid["pz"]
    lat_deg = grid["lat_deg"]
    latn = grid["latn"]
    t0 = time.time()
    # 低分辨率气旋位移场（东西向拉伸的风暴带）
    Wl, Hl = max(2, W // 2), max(2, H // 2)
    ul = ((np.arange(Wl, dtype=np.float32) + 0.5) / Wl).astype(np.float32)
    vl = ((np.arange(Hl, dtype=np.float32) + 0.5) / Hl).astype(np.float32)
    UL, VL = np.meshgrid(ul, vl)
    LATl = (VL - PY(0.5)) * PY(PI)
    rng = np.random.default_rng(seed)
    du = np.zeros((Hl, Wl), np.float32)
    dv = np.zeros((Hl, Wl), np.float32)
    n_cyc = 11
    for i in range(n_cyc):
        hemi = 1.0 if i % 2 == 0 else -1.0
        clat = hemi * float(rng.uniform(0.50, 1.02))
        clon = float(rng.uniform(0.0, TAU))
        R = float(rng.uniform(0.10, 0.24))
        amp = hemi * float(rng.uniform(0.45, 0.95))
        dlon = (UL - PY(clon / TAU) + PY(0.5)) % PY(1.0) - PY(0.5)
        dx = dlon * PY(TAU) * np.cos(LATl)
        dy = LATl - PY(clat)
        r = np.sqrt(dx * dx + dy * dy)
        mask = np.exp(-(r / PY(R)) ** 2 * PY(1.55))
        ang = amp * mask * PY(2.4)
        ca = np.cos(ang)
        sa = np.sin(ang)
        nx = dx * ca - dy * sa
        ny = dx * sa + dy * ca
        denom = PY(TAU) * np.maximum(np.cos(LATl), PY(0.15))
        du += ((nx - dx) / denom).astype(np.float32)
        dv += ((ny - dy) / PY(PI)).astype(np.float32)
    du_f = resize_wrap(du, W, H)
    dv_f = resize_wrap(dv, W, H)
    wu = fbm2(u, v, 3, 2, seed + 11) - PY(0.5)
    wv = fbm2(u, v, 3, 2, seed + 12) - PY(0.5)
    qu = u + du_f + PY(0.10) * wu
    qv = v + dv_f + PY(0.06) * wv
    base = fbm2(qu, qv, 7, 4, seed + 21, gain=0.54, ny_ratio=0.80)
    rid = fbm2(qu, qv, 6, 9, seed + 22, gain=0.52, ny_ratio=0.95, ridged=True)
    cir = fbm2(u, v, 4, 18, seed + 23, ny_ratio=1.15)
    dens = PY(0.56) * base + PY(0.27) * rid + PY(0.17) * cir
    al = np.abs(lat_deg)
    band = (PY(0.22) * np.exp(-(lat_deg / PY(8.0)) ** 2)
            + PY(0.16) * np.exp(-((al - PY(49.0)) / PY(15.0)) ** 2)
            + PY(0.07) * np.exp(-((al - PY(74.0)) / PY(12.0)) ** 2)
            - PY(0.13) * np.exp(-((al - PY(24.0)) / PY(11.0)) ** 2)
            + PY(0.05))
    density = dens * PY(0.95) + band * PY(0.34) - PY(0.43)
    alpha = smoothstep(PY(0.00), PY(0.34), density)
    cir_alpha = smoothstep(PY(0.60), PY(0.82), cir) * PY(0.13)
    alpha = PY(1.0) - (PY(1.0) - alpha) * (PY(1.0) - cir_alpha)
    # 极区：换成 3D 球面噪声（避免等距圆柱极点的放射状拉丝）
    pcl = fbm3(px, py, pz, 3, 5.5, seed + 31)
    alpha_polar = smoothstep(PY(0.42), PY(0.70), pcl) * PY(0.90)
    wpol = smoothstep(PY(0.60), PY(0.88), latn)
    alpha = lerp(alpha, alpha_polar, wpol)
    alpha = np.clip(alpha * PY(0.94), 0.0, PY(0.94))
    thick = smoothstep(PY(0.28), PY(0.85), density)
    rgb_arr = lerp(rgb((235, 241, 248))[None, None, :], rgb((250, 252, 255))[None, None, :],
                   thick[..., None]).astype(np.float32)
    a8 = (alpha * 255.0 + 0.5).astype(np.uint8)
    r8 = np.clip(rgb_arr, 0, 255).astype(np.uint8)
    print("    clouds alpha mean=%.3f max=%d  %.1fs"
          % (float(alpha.mean()), int(a8.max()), time.time() - t0))
    return a8, r8


def gen_night(land, h, latn, coast, moist, seed, W, H):
    """夜面城市灯光：黑底 + 暖黄城市簇（沿海更亮）+ 多级高斯辉光。"""
    rng = np.random.default_rng(seed)
    t0 = time.time()
    weights = (land
               * (PY(0.14) + PY(0.86) * coast)
               * (PY(1.0) - smoothstep(PY(0.55), PY(0.85), latn))
               * (PY(1.0) - smoothstep(PY(0.10), PY(0.30), h))
               * (PY(0.55) + PY(0.45) * moist))
    weights = np.clip(weights, 0.0, None) ** PY(1.7)
    total = float(weights.sum())
    core = np.zeros((H, W), np.float32)
    if total <= 0:
        print("    night: no land?")
        return np.zeros((H, W, 3), np.uint8)

    def splat(xc, yc, sig, amp):
        r = max(2, int(round(float(sig) * 3.0)))
        x0 = int(math.floor(xc)) - r
        x1 = int(math.floor(xc)) + r + 1
        y0 = max(0, int(math.floor(yc)) - r)
        y1 = min(H, int(math.floor(yc)) + r + 1)
        if y1 <= y0 or x1 <= x0:
            return
        xs = np.arange(x0, x1, dtype=np.float32)
        ys = np.arange(y0, y1, dtype=np.float32)[:, None]
        sig = max(float(sig), 0.35)
        gx = np.exp(-((xs - PY(xc)) ** 2) / (PY(2.0) * PY(sig * sig)))
        gy = np.exp(-((ys - PY(yc)) ** 2) / (PY(2.0) * PY(sig * sig)))
        g = gy * gx[None, :] * PY(amp)
        cols = np.mod(np.arange(x0, x1), W)
        for j in range(y1 - y0):
            np.add.at(core[y0 + j], cols, g[j])

    probs = (weights / total).ravel().astype(np.float64)
    probs = np.clip(probs, 0.0, None)
    probs = probs / probs.sum()
    n_metro = 165
    idx = rng.choice(W * H, size=n_metro, replace=False, p=probs)
    for k in idx:
        row = int(k) // W
        col = int(k) % W
        lon_c = (col + 0.5) / W * TAU
        lat_c = (0.5 - (row + 0.5) / H) * PI
        sig_deg = float(rng.uniform(0.12, 0.50))
        n_sat = int(rng.integers(14, 56))
        splat((col + 0.5), (row + 0.5), float(rng.uniform(1.4, 2.8)), float(rng.uniform(0.9, 1.7)))
        for _ in range(n_sat):
            dlon = rng.normal(0.0, sig_deg * 1.7) * math.pi / 180.0 / max(math.cos(lat_c), 0.2)
            dlat = rng.normal(0.0, sig_deg * 1.2) * math.pi / 180.0
            x = ((lon_c + dlon) / TAU) * W
            y = (0.5 - (lat_c + dlat) / PI) * H
            splat(x, y, float(np.exp(rng.uniform(math.log(0.6), math.log(2.1)))),
                  float(rng.uniform(0.30, 0.95)))
    # 散落村镇
    n_town = 3200
    idx = rng.choice(W * H, size=n_town, replace=False, p=probs)
    for k in idx:
        row = int(k) // W
        col = int(k) % W
        splat(col + 0.5, row + 0.5, float(np.exp(rng.uniform(math.log(0.5), math.log(1.3)))),
              float(rng.uniform(0.18, 0.65)))
    peak = float(core.max())
    if peak > 0:
        core = core / peak
    core = np.clip(core, 0.0, 1.0) ** PY(0.72)
    g1 = gauss_blur(core, 2.0)
    g2 = gauss_blur(core, 8.0)
    g3 = gauss_blur(core, 22.0)
    night = (core[..., None] * rgb((255, 246, 214))[None, None, :]
             + g1[..., None] * rgb((255, 214, 144))[None, None, :] * PY(1.15)
             + g2[..., None] * rgb((255, 184, 92))[None, None, :] * PY(1.0)
             + g3[..., None] * rgb((255, 154, 62))[None, None, :] * PY(0.62))
    night = np.clip(night, 0, 255).astype(np.uint8)
    night[night < 2] = 0
    print("    night bright px=%d  %.1fs" % (int((night[..., 0] > 40).sum()), time.time() - t0))
    return night


def gen_normal(h, land, grid):
    """由高程场求切线空间法线（+X=东，+Y=北，+Z=外法线）。"""
    H, W = h.shape
    hf = np.where(land > PY(0.5), h, h * PY(0.25)).astype(np.float32)
    dHdu = (np.roll(hf, -1, axis=1) - np.roll(hf, 1, axis=1)) * PY(0.5)
    dHdrow = (np.roll(hf, -1, axis=0) - np.roll(hf, 1, axis=0)) * PY(0.5)
    coslat = np.maximum(np.abs(np.cos(grid["lat"])), PY(0.22))
    strength = PY(210.0)
    nx = -dHdu * strength / coslat
    ny = dHdrow * strength
    nz = np.ones_like(nx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx = nx / ln
    ny = ny / ln
    nz = nz / ln
    out = np.dstack([nx * PY(0.5) + PY(0.5), ny * PY(0.5) + PY(0.5), nz * PY(0.5) + PY(0.5)])
    return np.clip(out * 255.0, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------- 预览渲染


def load_font(size):
    cands = [
        r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for p in cands:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size), ("msyh" in p or "simhei" in p)
            except Exception:
                continue
    return ImageFont.load_default(), False


def sphere_basis(lon0, lat0):
    c = unit_dir(lon0, lat0)
    east = np.array([-math.sin(lon0), math.cos(lon0), 0.0], dtype=np.float32)
    north = np.array([-math.sin(lat0) * math.cos(lon0), -math.sin(lat0) * math.sin(lon0),
                      math.cos(lat0)], dtype=np.float32)
    return c, east, north


def sphere_map(size, zoom, lon0, lat0):
    S = int(size)
    lin = ((np.arange(S, dtype=np.float32) + 0.5) / S * 2.0 - 1.0).astype(np.float32)
    XX = np.repeat(lin[None, :], S, axis=0) / PY(zoom)
    YY = np.repeat(-lin[:, None], S, axis=1) / PY(zoom)
    r2 = XX * XX + YY * YY
    inside = r2 <= PY(1.0)
    z = np.sqrt(np.clip(PY(1.0) - r2, 0.0, 1.0)).astype(np.float32)
    c, east, north = sphere_basis(lon0, lat0)
    wx = east[0] * XX + north[0] * YY + c[0] * z
    wy = east[1] * XX + north[1] * YY + c[1] * z
    wz = east[2] * XX + north[2] * YY + c[2] * z
    lon = np.arctan2(wy, wx).astype(np.float32)
    lat = np.arcsin(np.clip(wz, -1.0, 1.0)).astype(np.float32)
    return inside, lon, lat, z, r2, (c, east, north)


def sample_tex(tex, lon, lat):
    H, W = tex.shape[0], tex.shape[1]
    u = (lon / PY(TAU)) % PY(1.0)
    v = np.clip(PY(0.5) - lat / PY(PI), 0.0, 1.0)
    x = u * W - PY(0.5)
    y = v * H - PY(0.5)
    xf = np.floor(x)
    yf = np.floor(y)
    tx = (x - xf).astype(np.float32)
    ty = (y - yf).astype(np.float32)
    x0 = xf.astype(np.int32) % W
    x1 = (x0 + 1) % W
    y0 = np.clip(yf.astype(np.int32), 0, H - 1)
    y1 = np.clip(y0 + 1, 0, H - 1)
    c00 = tex[y0, x0]
    c10 = tex[y0, x1]
    c01 = tex[y1, x0]
    c11 = tex[y1, x1]
    top = c00 + (c10 - c00) * tx[..., None]
    bot = c01 + (c11 - c01) * tx[..., None]
    return top + (bot - top) * ty[..., None]


def backdrop(size, seed):
    S = int(size)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    cx = cy = (S - 1) / 2.0
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (S * 0.72)
    base = np.zeros((S, S, 3), np.float32)
    base[..., 0] = PY(3.0) + PY(7.0) * np.clip(1.0 - r, 0, 1)
    base[..., 1] = PY(4.0) + PY(8.0) * np.clip(1.0 - r, 0, 1)
    base[..., 2] = PY(7.0) + PY(13.0) * np.clip(1.0 - r, 0, 1)
    rng = np.random.default_rng(seed)
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), mode="RGB")
    d = ImageDraw.Draw(img)
    n = int(S * 0.5)
    for _ in range(n):
        x = float(rng.uniform(0, S))
        y = float(rng.uniform(0, S))
        b = float(rng.uniform(30, 150))
        d.point((x, y), fill=(int(b), int(b), int(b * 0.95)))
    return np.asarray(img, dtype=np.float32)


def bloom(arr_u8, radius=8.0, strength=0.85, threshold=190.0):
    a = arr_u8.astype(np.float32)
    b = np.clip(a - PY(threshold), 0.0, None)
    out = a.copy()
    for c in range(3):
        bl = gauss_blur(b[..., c] / 255.0, radius) * 255.0
        out[..., c] = out[..., c] + bl * PY(strength)
    return np.clip(out, 0, 255).astype(np.uint8)


def draw_label(img, lines, cjk_ok=True):
    S = img.size[0]
    font_big, _ = load_font(max(16, S // 30))
    font_small, _ = load_font(max(11, S // 52))
    tmp = ImageDraw.Draw(img)
    b0 = tmp.textbbox((0, 0), lines[0], font=font_big)
    b1 = tmp.textbbox((0, 0), lines[1], font=font_small)
    tw = max(b0[2] - b0[0], b1[2] - b1[0])
    x, y = int(S * 0.030), int(S * 0.030)
    pad = 14
    bar_w = tw + pad * 2 + 18
    bar_h = pad * 2 + (b0[3] - b0[1]) + 6 + (b1[3] - b1[1])
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle([x, y, x + bar_w, y + bar_h], radius=7, fill=(6, 8, 12, 168))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(img)
    d.rectangle([x + pad, y + pad + 2, x + pad + 5, y + pad + (b0[3] - b0[1])], fill=(253, 253, 31))
    d.text((x + pad + 14, y + pad), lines[0], fill=(243, 245, 249), font=font_big)
    d.text((x + pad + 14, y + pad + (b0[3] - b0[1]) + 6), lines[1], fill=(158, 166, 180), font=font_small)
    return img


def render_star_preview(path, out_path, cfg, lon0, lat0, size=760, zoom=1.0):
    tex = load_rgb(path)
    inside, lon, lat, z, r2, basis = sphere_map(size, zoom, lon0, lat0)
    rgbv = sample_tex(tex, lon, lat)
    mu = np.clip(z, 0.0, 1.0)
    shade = PY(0.40) + PY(0.60) * np.power(mu, PY(0.62))
    img = rgbv * shade[..., None] * inside[..., None].astype(np.float32)
    r = np.sqrt(np.maximum(r2, 0.0))
    glow = np.where(r > PY(1.0), np.exp(-(r - PY(1.0)) * PY(4.2)), PY(0.0)).astype(np.float32)
    base_col = tex.reshape(-1, 3).mean(axis=0)
    img = img + glow[..., None] * base_col[None, None, :] * PY(0.16)
    body = np.clip(img, 0, 255).astype(np.uint8)
    body = bloom(body, radius=max(4.0, size / 90.0), strength=0.55, threshold=214.0)
    out = backdrop(size, 7) + body.astype(np.float32)
    out = np.clip(out, 0, 255).astype(np.uint8)
    im = Image.fromarray(out, mode="RGB")
    im = draw_label(im, [cfg["name"] + " / " + cfg["name_en"],
                         cfg["spectral"] + " · 2048×1024 EQUIRECTANGULAR"])
    im.save(out_path, format="JPEG", quality=90, subsampling=0, optimize=True)
    return out_path


def render_planet_preview(day_path, cloud_path, night_path, out_path, lon0, lat0,
                          size=760, zoom=1.0, label=("母星 / HOMEWORLD", "M 级 · 海洋/大陆/云层/夜灯 · 2048×1024")):
    day = load_rgb(day_path)
    cloud = load_rgba(cloud_path)
    night = load_rgb(night_path)
    inside, lon, lat, z, r2, basis = sphere_map(size, zoom, lon0, lat0)
    c, east, north = basis
    dayv = sample_tex(day, lon, lat)
    nightv = sample_tex(night, lon, lat)
    cl = sample_tex(cloud, lon, lat)
    calpha = np.clip(cl[..., 3] / 255.0, 0.0, 1.0)
    ccol = cl[..., :3]
    # 世界法线（也是太阳方向基准）
    wx = np.sin(lon) * np.cos(lat)
    wy = -np.cos(lon) * np.cos(lat)
    # 注意：sphere_map 的 lon/lat 是世界坐标方向，直接用单位向量
    world = np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=-1)
    L = (east * PY(-0.52) + north * PY(0.38) + c * PY(0.76))
    L = L / np.linalg.norm(L)
    ndotl = np.clip(world[..., 0] * L[0] + world[..., 1] * L[1] + world[..., 2] * L[2], 0.0, 1.0)
    day_w = smoothstep(PY(-0.05), PY(0.22),
                       world[..., 0] * L[0] + world[..., 1] * L[1] + world[..., 2] * L[2])
    sun = PY(0.22) + PY(0.78) * ndotl
    color = dayv * (sun * day_w)[..., None]
    cloud_lit = ccol * (PY(0.30) + PY(0.66) * ndotl)[..., None]
    color = lerp(color, cloud_lit, (calpha * day_w * PY(0.88))[..., None])
    color = color + nightv * ((PY(1.0) - day_w) ** PY(1.3))[..., None] * PY(1.55)
    rim = np.power(PY(1.0) - np.clip(z, 0, 1), PY(3.0)) * inside.astype(np.float32)
    color = color + rim[..., None] * rgb((70, 128, 196))[None, None, :] * PY(0.65) * (PY(0.40) + PY(0.60) * day_w)[..., None]
    body = np.clip(color, 0, 255).astype(np.uint8)
    body = bloom(body, radius=max(3.0, size / 160.0), strength=0.35, threshold=228.0)
    out = backdrop(size, 11) + body.astype(np.float32)
    out = np.clip(out, 0, 255).astype(np.uint8)
    im = Image.fromarray(out, mode="RGB")
    im = draw_label(im, [label[0], label[1]])
    im.save(out_path, format="JPEG", quality=90, subsampling=0, optimize=True)
    return out_path


def find_star_center(lum, mode="dark", gh=8, gw=16):
    small = _downsample_frac(lum, gh, gw)
    pick = np.argmin(small) if mode == "dark" else np.argmax(small)
    idx = np.unravel_index(int(pick), small.shape)
    lat = (0.5 - (idx[0] + 0.5) / gh) * PI
    lon = (idx[1] + 0.5) / gw * TAU
    return lon, lat


def find_star_spot_center(lum, gh=8, gw=16):
    return find_star_center(lum, "dark", gh, gw)


def find_coast_center(water_path, gh=8, gw=16):
    water = load_rgb(water_path)[..., 0] / 255.0
    land = 1.0 - water
    small = _downsample_frac(land, gh, gw)
    score = -np.abs(small - 0.55)
    idx = np.unravel_index(int(np.argmax(score)), small.shape)
    lat = (0.5 - (idx[0] + 0.5) / gh) * PI * 0.9
    lon = (idx[1] + 0.5) / gw * TAU
    return lon, lat


def render_previews(seed):
    os.makedirs(PREV_DIR, exist_ok=True)
    path = lambda n: os.path.join(OUT_DIR, n)
    made = []
    main = []
    # 恒星：逐个可独立预览（便于调参阶段只生成单星）；B 型取最亮耀斑区、其余取黑子区
    for key in ["star-a", "star-b", "star-c"]:
        f = path(key + ".jpg")
        if not os.path.exists(f):
            continue
        lum = load_rgb(f).mean(axis=2)
        mode = "dark"
        lon0, lat0 = find_star_center(lum, mode)
        main.append(render_star_preview(f, os.path.join(PREV_DIR, key + ".jpg"),
                                        STAR_CFGS[key], lon0, lat0, size=760, zoom=1.0))
    if os.path.exists(path("star-a.jpg")):
        lum = load_rgb(path("star-a.jpg")).mean(axis=2)
        lon0, lat0 = find_star_spot_center(lum)
        made.append(render_star_preview(path("star-a.jpg"), os.path.join(PREV_DIR, "star-a-closeup.jpg"),
                                        STAR_CFGS["star-a"], lon0, lat0, size=760, zoom=2.0))
    # 母星需要昼面/云层/夜面/水遮罩齐备
    if all(os.path.exists(path(n)) for n in
           ["planet-day.jpg", "planet-clouds.png", "planet-night.jpg", "planet-water-mask.jpg"]):
        lon0, lat0 = find_coast_center(path("planet-water-mask.jpg"))
        main.append(render_planet_preview(path("planet-day.jpg"), path("planet-clouds.png"),
                                          path("planet-night.jpg"),
                                          os.path.join(PREV_DIR, "planet.jpg"), lon0, lat0, 760, 1.0))
        made.append(render_planet_preview(path("planet-day.jpg"), path("planet-clouds.png"),
                                          path("planet-night.jpg"),
                                          os.path.join(PREV_DIR, "planet-closeup.jpg"), lon0, lat0, 760, 2.2,
                                          label=("母星近景 / HOMEWORLD CLOSE-UP",
                                                 "海岸线 / 云层 / 夜灯 · 2048×1024 EQUIRECTANGULAR")))
    if len(main) == 4:
        contact_sheet(main, os.path.join(PREV_DIR, "contact-sheet.jpg"))
    if any(os.path.exists(path(n)) for n in [a[0] for a in SEAM_ASSETS]):
        seam_sheet(os.path.join(PREV_DIR, "seam-check.jpg"))
    return main + made


def contact_sheet(paths, out_path):
    cell = 600
    pad = 22
    top = 92
    W = pad * 3 + cell * 2
    H = top + pad * 3 + cell * 2 + 40
    bg = (6, 8, 12)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    f_title, cjk = load_font(30)
    f_sub, _ = load_font(16)
    f_cap, _ = load_font(17)
    d.rectangle([pad, 34, pad + 10, 54], fill=(253, 253, 31))
    d.text((pad + 22, 30), "三体纪元 v1.4 · 四天体贴图" if cjk else "TRISOLARIS v1.4 · 4-BODY TEXTURES",
           fill=(240, 242, 246), font=f_title)
    sub = "2048×1024 · EQUIRECTANGULAR · SEAMLESS IN LONGITUDE"
    sb = d.textbbox((0, 0), sub, font=f_sub)
    d.text((W - pad - (sb[2] - sb[0]), 42), sub, fill=(140, 148, 160), font=f_sub)
    caps = ["恒星 A · G 型 / STAR A", "恒星 B · A 型 / STAR B",
            "恒星 C · K/M 型 / STAR C", "母星 · 海洋/大陆/云层 / HOMEWORLD"]
    for i, p in enumerate(paths):
        im = Image.open(p).convert("RGB").resize((cell, cell), Image.LANCZOS)
        col = i % 2
        row = i // 2
        x = pad + col * (cell + pad)
        y = top + row * (cell + pad + 30) + 26
        img.paste(im, (x, y))
        d.rectangle([x, y, x + cell - 1, y + cell - 1], outline=(40, 46, 56))
        d.text((x, y + cell + 6), caps[i], fill=(196, 202, 212), font=f_cap)
    img.save(out_path, format="JPEG", quality=90, subsampling=0, optimize=True)
    print("  [preview]", os.path.relpath(out_path, ROOT))


SEAM_ASSETS = [
    ("star-a.jpg", "恒星 A / STAR A", False),
    ("star-b.jpg", "恒星 B / STAR B", False),
    ("star-c.jpg", "恒星 C / STAR C", False),
    ("planet-day.jpg", "母星昼面 / PLANET DAY", False),
    ("planet-clouds.png", "云层 α / CLOUDS ALPHA", True),
    ("planet-night.jpg", "夜灯 / NIGHT LIGHTS", False),
    ("planet-normal.jpg", "法线 / NORMAL", False),
    ("planet-water-mask.jpg", "海陆遮罩 / WATER MASK", False),
]


def seam_sheet(out_path):
    cell_w, cell_h = 300, 168
    cols = 4
    rows = 2
    img = Image.new("RGB", (cell_w * cols + 20, cell_h * rows + 110), (6, 8, 12))
    d = ImageDraw.Draw(img)
    f_title, cjk = load_font(24)
    f_cap, _ = load_font(13)
    d.rectangle([16, 18, 26, 34], fill=(253, 253, 31))
    d.text((34, 14), "左右边缘接缝核对 / LONGITUDE SEAM CHECK（中线两侧为 W-1 | 0 列）" if cjk
           else "LONGITUDE SEAM CHECK", fill=(240, 242, 246), font=f_title)
    for i, (name, cap, alpha_channel) in enumerate(SEAM_ASSETS):
        path = os.path.join(OUT_DIR, name)
        if not os.path.exists(path):
            continue
        im = Image.open(path)
        arr = np.asarray(im, dtype=np.float32)
        H, W = arr.shape[0], arr.shape[1]
        band_y0 = H // 2 - 64
        band_y1 = H // 2 + 64
        if alpha_channel:
            a = arr[band_y0:band_y1, :, 3:4] / 255.0
            rgbv = arr[band_y0:band_y1, :, :3] * a + (36.0) * (1.0 - a)
        else:
            rgbv = arr[band_y0:band_y1, :, :3]
        strip = np.concatenate([rgbv[:, W - 96:W], rgbv[:, 0:96]], axis=1)
        strip = np.clip(strip, 0, 255).astype(np.uint8)
        sim = Image.fromarray(strip, mode="RGB").resize((260, 120), Image.LANCZOS)
        col = i % cols
        row = i // cols
        x = 10 + col * cell_w
        y = 74 + row * cell_h
        img.paste(sim, (x + 20, y + 18))
        d.rectangle([x + 20, y + 18, x + 20 + 260 - 1, y + 18 + 120 - 1], outline=(40, 46, 56))
        d.line([(x + 20 + 130, y + 12), (x + 20 + 130, y + 18)], fill=(253, 253, 31), width=2)
        d.text((x + 20, y + 142), cap, fill=(196, 202, 212), font=f_cap)
    img.save(out_path, format="JPEG", quality=90, subsampling=0, optimize=True)
    print("  [preview]", os.path.relpath(out_path, ROOT))


# ---------------------------------------------------------------- 校验 / manifest


ASSET_SPECS = [
    {"key": "star-a", "file": "star-a.jpg", "format": "jpeg", "kind": "star",
     "name": "恒星 A", "nameEn": "STAR A", "desc": "G 型 · 银白/暖白：米白-淡金米粒组织、黑子群、光斑、耀斑环",
     "usage": "近景恒星表面贴图：MeshBasicMaterial.map 或 MeshStandardMaterial.emissiveMap（自发光）",
     "alpha": False, "minLum": 40.0},
    {"key": "star-b", "file": "star-b.jpg", "format": "jpeg", "kind": "star",
     "name": "恒星 B", "nameEn": "STAR B", "desc": "A 型 · 蓝白：青白-淡蓝米粒组织、强耀斑环、暗斑",
     "usage": "近景恒星表面贴图：自发光贴图，配合蓝色日冕 glow",
     "alpha": False, "minLum": 40.0},
    {"key": "star-c", "file": "star-c.jpg", "format": "jpeg", "kind": "star",
     "name": "恒星 C", "nameEn": "STAR C", "desc": "K/M 型 · 橙红：橙红米粒组织、大黑子、暗斑、耀斑",
     "usage": "近景恒星表面贴图：自发光贴图，配合橙色日冕 glow",
     "alpha": False, "minLum": 35.0},
    {"key": "planet-day", "file": "planet-day.jpg", "format": "jpeg", "kind": "planet",
     "name": "母星昼面", "nameEn": "HOMEWORLD DAY",
     "desc": "类地行星昼面：海洋深浅/大陆生物群系/海岸线/冰盖/湖泊，等距圆柱，横向无缝",
     "usage": "母星球体 map（sRGB）；配合云层/夜面/法线/水遮罩", "alpha": False, "minLum": 20.0},
    {"key": "planet-clouds", "file": "planet-clouds.png", "format": "png", "kind": "planet-alpha",
     "name": "母星云层", "nameEn": "HOMEWORLD CLOUDS",
     "desc": "透明云层：CMB 赤道辐合带 + 副热带晴空 + 中纬风暴带 + 气旋漩涡，白/灰白，直通 alpha",
     "usage": "半径略大于行星的独立球体：map + transparent + depthWrite:false，纹理直通 alpha（非预乘）",
     "alpha": True, "minLum": 0.0},
    {"key": "planet-night", "file": "planet-night.jpg", "format": "jpeg", "kind": "planet",
     "name": "母星夜面", "nameEn": "HOMEWORLD NIGHT",
     "desc": "夜面城市灯光：黑底暖黄点簇，沿海更亮，含辉光",
     "usage": "夜面 emissiveMap（与昼面同球体，AdditiveBlending 叠加或 emissiveIntensity 控制）",
     "alpha": False, "minLum": 0.4},
    {"key": "planet-normal", "file": "planet-normal.jpg", "format": "jpeg", "kind": "planet",
     "name": "母星法线", "nameEn": "HOMEWORLD NORMAL",
     "desc": "可选切线空间法线：陆地/山脉起伏，海洋近乎平坦（+X=东，+Y=北，+Z=外法线）",
     "usage": "normalMap（可选，近景地形）；若方向相反可设 normalScale=(1,-1)",
     "alpha": False, "minLum": 40.0},
    {"key": "planet-water-mask", "file": "planet-water-mask.jpg", "format": "jpeg", "kind": "planet",
     "name": "母星海陆遮罩", "nameEn": "HOMEWORLD WATER MASK",
     "desc": "可选遮罩：白=海洋/湖泊，黑=陆地/冰盖，供海洋高光/粗糙度或水体着色使用",
     "usage": "roughnessMap / metalnessMap / specular 强度遮罩（需按材质语义取反）",
     "alpha": False, "minLum": 25.0},
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def seam_stats(arr):
    """左右环绕接缝：比较第 0 列与第 W-1 列（本应相邻）平均绝对差。
    同时给出正常相邻列基线、以及随机远处列对照，证明接缝无阶跃。"""
    a = arr.astype(np.float32)
    left = a[:, 0]
    right = a[:, -1]
    wrap = float(np.abs(left - right).mean())
    adjacent = float(np.abs(a[:, 1:] - a[:, :-1]).mean())
    random_gap = float(np.abs(a[:, 0] - a[:, a.shape[1] // 2]).mean())
    return wrap, adjacent, random_gap


def build_manifest(seed):
    files = []
    for spec in ASSET_SPECS:
        path = os.path.join(OUT_DIR, spec["file"])
        if not os.path.exists(path):
            continue
        im = Image.open(path)
        arr = np.asarray(im)
        h, w = arr.shape[0], arr.shape[1]
        wrap, adjacent, random_gap = seam_stats(arr)
        rec = {
            "key": spec["key"],
            "path": "public/textures/" + spec["file"],
            "url": "/textures/" + spec["file"],
            "name": spec["name"],
            "nameEn": spec["nameEn"],
            "description": spec["desc"],
            "kind": spec["kind"],
            "format": "png" if spec["format"] == "png" else "jpeg",
            "width": int(w), "height": int(h),
            "aspect": "2:1",
            "projection": "equirectangular",
            "wrap": "longitude-repeat",
            "bytes": os.path.getsize(path),
            "sha256": sha256_file(path),
            "source": "procedural",
            "tool": "python3 + numpy + Pillow",
            "generator": "scripts/gen-planet-textures.py",
            "seed": seed,
            "usage": spec["usage"],
            "seam": {
                "wrapMeanAbsDiff": round(wrap, 3),
                "adjacentMeanAbsDiff": round(adjacent, 3),
                "unrelatedColumnsMeanAbsDiff": round(random_gap, 3),
                "ratioVsAdjacent": round(wrap / max(adjacent, 1e-3), 3),
            },
        }
        if spec["format"] == "png":
            a = arr[..., 3].astype(np.float32) / 255.0
            rec["alpha"] = {
                "channels": 4,
                "min": int(arr[..., 3].min()),
                "max": int(arr[..., 3].max()),
                "mean": round(float(a.mean()), 4),
                "transparentFraction": round(float((a < 0.02).mean()), 4),
                "opaqueFraction": round(float((a > 0.98).mean()), 4),
                "premultiplied": False,
            }
        lum = arr[..., :3].astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
        rec["luminance"] = {
            "mean": round(float(lum.mean()), 2),
            "std": round(float(lum.std()), 2),
            "max": round(float(lum.max()), 2),
            "p99": round(float(np.percentile(lum, 99)), 2),
            "p999": round(float(np.percentile(lum, 99.9)), 2),
            "brightFraction": round(float((lum > 60).mean()), 4),
        }
        files.append(rec)
    return {
        "version": "v1.4",
        "project": "三体纪元 TRISOLARIS: CIVILIZATION",
        "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "generator": "scripts/gen-planet-textures.py",
        "generatorCmd": "python scripts/gen-planet-textures.py --seed %d --size 2048" % seed,
        "seed": seed,
        "resolution": {"width": 2048, "height": 1024, "projection": "equirectangular",
                       "wrapS": "repeat (longitude)", "wrapT": "clamp (latitude)",
                       "uOrigin": "image left = u=0", "vOrigin": "image top = north pole (lat +90°)"},
        "source": "100% procedural（numpy 值噪声/Worley + Pillow 编码），未使用任何下载或第三方素材",
        "license": "original work, generated for this project（随项目分发）",
        "textures": files,
        "threeJsHints": {
            "loading": "new THREE.TextureLoader().load('/textures/star-a.jpg')",
            "colorSpace": "texture.colorSpace = THREE.SRGBColorSpace（颜色贴图）；法线/遮罩贴图保持 NoColorSpace",
            "wrap": "texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping",
            "anisotropy": "Math.min(8, renderer.capabilities.getMaxAnisotropy())——近景有益",
            "cloudLayer": "独立球体，半径 = 行星半径 × 1.012；MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, opacity: 0.95 })",
            "nightLights": "夜面 emissiveMap + emissiveIntensity，或叠加 AdditiveBlending 黑底贴图（1-dayFactor 混合）",
            "atmosphere": "Fresnel 背面大气壳（不透明贴图）；贴图本身不含大气",
            "normalMap": "可选：normalMap + normalScale（若绿色通道方向相反则用 (1,-1)）",
            "waterMask": "可选：roughnessMap 取反，或海洋高光强度遮罩",
            "lazyLoad": "仅进入近景/首次点击时加载对应贴图，避免首屏并发 8 张 2048 纹理",
        },
        "previews": [
            "public/textures/preview/contact-sheet.jpg",
            "public/textures/preview/star-a.jpg",
            "public/textures/preview/star-a-closeup.jpg",
            "public/textures/preview/planet.jpg",
            "public/textures/preview/planet-closeup.jpg",
            "public/textures/preview/seam-check.jpg",
        ],
        "notes": [
            "横向（经度）严格无缝：所有噪声在 u 方向周期，左右边缘可直接 RepeatWrapping 平铺。",
            "纵向为极点，等距圆柱天然存在极点压缩，属于投影特性；球体渲染时极点处无接缝。",
            "JPEG 采用 4:4:4（无色彩二次采样）保证近景细节；云层 PNG 为直通 alpha（非预乘）。",
            "夜面图为纯黑底 + 暖黄灯光，建议 AdditiveBlending 或 emissiveMap 使用，避免污染昼面。",
        ],
    }


def verify_report(seed):
    manifest = build_manifest(seed)
    print("\n=== verification ===")
    ok = True
    for rec in manifest["textures"]:
        path = os.path.join(ROOT, rec["path"])
        im = Image.open(path)
        dims_ok = (rec["width"], rec["height"]) == (2048, 1024)
        lum = rec.get("luminance", {})
        seam = rec["seam"]
        pass_seam = (seam["wrapMeanAbsDiff"] <= 2.0 * seam["adjacentMeanAbsDiff"] + 2.5
                     and seam["wrapMeanAbsDiff"] <= 16.0)
        pass_lum = lum.get("mean", 0) >= 0.2
        if rec["key"] == "planet-night":
            pass_lum = (lum.get("max", 0) >= 180 and lum.get("brightFraction", 0) >= 0.0004)
        if rec["key"] == "planet-clouds":
            a = rec["alpha"]
            pass_lum = (a["min"] <= 2 and a["max"] >= 200 and 0.15 <= a["mean"] <= 0.65)
        status = "PASS" if (dims_ok and pass_seam and pass_lum) else "FAIL"
        if status == "FAIL":
            ok = False
        print("%-18s %4dx%-4d %7.1fKB  seam wrap=%.2f adj=%.2f ratio=%.2f  lum=%5.1f  %s"
              % (rec["key"], rec["width"], rec["height"], rec["bytes"] / 1024.0,
                 seam["wrapMeanAbsDiff"], seam["adjacentMeanAbsDiff"], seam["ratioVsAdjacent"],
                 lum.get("mean", 0), status))
    return manifest, ok


# ---------------------------------------------------------------- main


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="三体纪元 v1.4 四天体贴图程序化生成器")
    p.add_argument("--seed", type=int, default=DEFAULT_SEED)
    p.add_argument("--size", type=int, default=2048, help="贴图宽度（高度 = size/2）")
    p.add_argument("--only", type=str, default="", help="逗号分隔：star-a,star-b,star-c,planet")
    p.add_argument("--no-preview", action="store_true")
    p.add_argument("--preview-only", action="store_true")
    p.add_argument("--verify-only", action="store_true", help="只校验已有贴图并重写 manifest（不生成、不渲染预览）")
    p.add_argument("--quality", type=int, default=90)
    return p.parse_args(argv)


def asset_seed(base, key):
    h = hashlib.sha256(("trisolaris-v14-" + key).encode("utf-8")).hexdigest()
    return (base + int(h[:8], 16)) & 0xFFFFFFFF


def main(argv=None):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    args = parse_args(argv)
    W = args.size
    if W % 2 != 0 or W < 512:
        sys.exit("--size 必须是 >=512 的偶数")
    H = W // 2
    os.makedirs(OUT_DIR, exist_ok=True)
    t_start = time.time()
    print("三体纪元 v1.4 · 贴图生成  seed=%d  %dx%d" % (args.seed, W, H))
    keys = [s.strip() for s in args.only.split(",") if s.strip()] if args.only else \
        ["star-a", "star-b", "star-c", "planet"]
    valid = {"star-a", "star-b", "star-c", "planet"}
    bad = [k for k in keys if k not in valid]
    if bad:
        sys.exit("未知 --only 项: %s（可选 %s）" % (",".join(bad), ",".join(sorted(valid))))
    if args.preview_only or args.verify_only:
        keys = []
    clock = time.time()
    grid = build_grid(W, H) if keys else None
    if keys:
        print("grid %.1fs" % (time.time() - clock))
    if "star-a" in keys:
        gen_star("star-a", grid, asset_seed(args.seed, "star-a"), W, H)
    if "star-b" in keys:
        gen_star("star-b", grid, asset_seed(args.seed, "star-b"), W, H)
    if "star-c" in keys:
        gen_star("star-c", grid, asset_seed(args.seed, "star-c"), W, H)
    if "planet" in keys:
        gen_planet(grid, asset_seed(args.seed, "planet"), W, H, args.quality)
    if not (args.no_preview or args.verify_only):
        render_previews(args.seed)
    manifest, ok = verify_report(args.seed)
    mpath = os.path.join(OUT_DIR, "manifest.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("\nmanifest -> %s" % os.path.relpath(mpath, ROOT))
    print("done in %.1fs" % (time.time() - t_start))
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
