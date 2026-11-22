#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""《三体纪元》v1.4 启动动画 · 「纪元存续理事会」徽章资产生成器
================================================================

按 docs/V4_SPEC.md §1.2 生成启动动画第 1/6 幕使用的徽章资产：

  三颗银白天体（不等边三角形，A 最大 / B 次之 / C 最小）
  + 下方粗月牙形轨道弧（开口朝上，像托盘托住三体）
  + 轨道弧右端箭头指向右上（沿切线方向）
  + 纯黑背景、银白主体约 30–40%、大量负空间。

纯程序化几何，无任何第三方/版权素材、无位图描摹、无字体依赖。
SVG 为唯一几何源，PNG 由 Edge headless 渲染同一 SVG 得到。

产物（路径冻结，startup-pv 直接引用）：
  public/startup/council-emblem.svg                   主徽章 1024×1024（含 #000 底）
  public/startup/council-emblem-2048-black.png        2048×2048 黑底渲染
  public/startup/council-emblem-2048-transparent.png  2048×2048 透明底渲染（RGBA）
  public/startup/council-emblem-mark.svg              仅徽记（透明底、紧凑 viewBox、无文字）
  public/startup/reticle-ring.svg                     准星环（透明底、正下方 24° 缺口）
  artifacts/startup-art/*.png                         验收预览（黑底预览 / 200% 裁切 / 透明棋盘格 / 小尺寸 mark / 准星 / 幕 1 合成）
  artifacts/startup-art/report.json                   尺寸 / 覆盖率 / alpha / 哈希自检报告

用法（本机没有系统 Python，用 DSH 自带 Python）：
  & "C:\Users\hp000001\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" scripts/gen-startup-art.py
  ... --quick      只写 SVG + 渲染 2048 黑底并测量（调参用，不生成预览）
  ... --no-edge    只写 SVG（不渲染 PNG）

依赖：Python 3.9+；Pillow（预览与自检）；Microsoft Edge（headless 渲染）。
可用环境变量 EDGE_PATH 覆盖 Edge 路径。

几何说明见 docs/STARTUP_ART.md。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - 预览/自检可降级
    Image = None

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "public" / "startup"
ARTIFACT_DIR = ROOT / "artifacts" / "startup-art"
EDGE = os.environ.get("EDGE_PATH", r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n'

# ---------------------------------------------------------------------------
# 设计令牌
# ---------------------------------------------------------------------------
CANVAS = 1024.0
COLORS = {
    "void": "#000000",        # 纯黑背景
    "ice": "#F8FBFF",         # 高光冰白
    "silver_0": "#E9EFF7",    # 亮银
    "silver_1": "#CDD8E4",    # 银
    "silver_2": "#A6B2C1",    # 灰银
    "silver_3": "#7B8796",    # 钢灰
    "silver_4": "#4B535E",    # 暗钢
    "silver_5": "#30363E",    # 阴影石墨
    "reticle": "#DCE5EF",     # 准星环银白细线
}

# 天体球面明暗（径向渐变；highlight 偏左上。offset 为渐变半径的比例）
SPHERE_STOPS = [
    (0.00, "#FFFFFF"),
    (0.08, "#FAFDFF"),
    (0.20, "#EAF0F7"),
    (0.36, "#CFD9E4"),
    (0.52, "#ADB8C6"),
    (0.68, "#8892A0"),
    (0.84, "#646D79"),
    (0.94, "#4A515A"),
    (1.00, "#3A4149"),
]
SPHERE_HIGHLIGHT = (-0.33, -0.37, 1.50)  # (相对半径的 x 偏移, y 偏移, 渐变半径倍数)

# 天体辉光（径向渐变：offset → alpha 比例，最终乘以 ARC["glow_strength"]）
# 峰值在球体边缘外侧形成“冠状”发光，向外快速衰减为极淡雾晕
GLOW_STOPS = [
    (0.00, 0.62), (0.30, 0.28), (0.42, 0.34), (0.48, 0.32),
    (0.56, 0.19), (0.70, 0.08), (0.84, 0.03), (1.00, 0.0),
]
# 天体亮度层级（A 最近/最亮，B 次，C 最远/略暗；制造三体纵深）
BODY_OPACITY = {"A": 1.00, "B": 0.96, "C": 0.91}
# 天体边缘：细轮廓线 + 右下受光亮边
RIM_STROKE = {"color": "#CBD6E3", "opacity": 0.22, "width": 1.4}
RIM_LIGHT = {"color": "#F4F8FD", "opacity": 0.40, "width": 2.4, "a0": 14.0, "a1": 78.0}
# 轨道弧内缘高光细线
ARC_HIGHLIGHT = {"opacity": 0.28, "width": 2.0}
# 轨道弧金属渐变（左暗右亮：向存续/箭头方向变亮）
ARC_METAL_STOPS = [
    (0.00, "#8E99A8"), (0.30, "#A8B3C1"), (0.58, "#CBD6E3"),
    (0.82, "#E8EEF6"), (1.00, "#F5F9FD"),
]
# 箭头渐变（底边与弧端亮度接近，避免硬接缝）
ARROW_STOPS = [
    (0.00, "#EDF3FA"), (0.55, "#F9FCFF"), (1.00, "#FFFFFF"),
]

# ---------------------------------------------------------------------------
# 几何（全部以 1024×1024 设计单位书写；坐标原点左上，y 向下）
# ---------------------------------------------------------------------------
# 三颗天体：不等边三角形；A 最大、B 次之、C 最小
TRIO = {
    "A": {"cx": 360.0, "cy": 387.0, "r": 122.0},
    "B": {"cx": 682.0, "cy": 417.0, "r": 84.0},
    "C": {"cx": 562.0, "cy": 585.0, "r": 60.0},
}
# 三体系统的重心 = 轨道弧圆心：三体是「被观测/被守护」的舞蹈，弧是它们的轨道
BARY = (
    sum(b["cx"] for b in TRIO.values()) / float(len(TRIO)),
    sum(b["cy"] for b in TRIO.values()) / float(len(TRIO)),
)
ARC = {
    "cx": BARY[0],
    "cy": BARY[1],
    "R": 328.0,          # 轨道弧中心线半径（圆心 = 三体重心）
    "half_span": 61.0,   # 弧跨越 90°±61°（即 29°..151°，穿过正下方，像托盘托住三体）
    "w": 72.0,           # 弧粗（统一线宽）
    "arrow_len": 106.0,  # 箭头长
    "arrow_half": 57.0,  # 箭头底半宽
    "glow_k": 2.25,      # 天体辉光半径 = glow_k × r
    "glow_strength": 0.82,
}
RETICLE = {
    "cx": 512.0,
    "cy": 512.0,
    "r_outer": 474.0,
    "gap_half": 12.0,  # 正下方缺口：78°..102°
}


def n(v: float) -> str:
    """紧凑数字格式化（SVG 用）。"""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return ("%.3f" % v).rstrip("0").rstrip(".")


def polar(cx: float, cy: float, r: float, deg: float):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def pstr(p) -> str:
    return "%s %s" % (n(p[0]), n(p[1]))


def arc_band_path(cx, cy, R, half_span, width) -> str:
    """月牙轨道弧的填充轮廓（两条同心圆弧 + 两端直边）。"""
    th_a = 90.0 + half_span
    th_b = 90.0 - half_span
    ro = R + width / 2.0
    ri = R - width / 2.0
    so = polar(cx, cy, ro, th_a)
    eo = polar(cx, cy, ro, th_b)
    si = polar(cx, cy, ri, th_a)
    ei = polar(cx, cy, ri, th_b)
    # 从 th_a 到 th_b 角度递减 = 屏幕逆时针 = sweep 0；回程角度递增 = sweep 1
    return (
        "M %s A %s %s 0 0 0 %s L %s A %s %s 0 0 1 %s Z"
        % (pstr(so), n(ro), n(ro), pstr(eo), pstr(ei), n(ri), n(ri), pstr(si))
    )


def arrow_geometry() -> dict:
    """轨道弧右端（39°）沿切线方向的箭头。切线朝右上（约 51°）。"""
    cx, cy, R = ARC["cx"], ARC["cy"], ARC["R"]
    th = 90.0 - ARC["half_span"]
    ex, ey = polar(cx, cy, R, th)
    tx, ty = math.sin(math.radians(th)), -math.cos(math.radians(th))
    nx, ny = math.cos(math.radians(th)), math.sin(math.radians(th))
    L, hw = ARC["arrow_len"], ARC["arrow_half"]
    # 底边中心略向弧内回退 3 单位，确保箭头与弧体无缝相接
    bxc, byc = ex - tx * 3.0, ey - ty * 3.0
    return {
        "end": (ex, ey),
        "base": (bxc, byc),
        "tangent": (tx, ty),
        "normal": (nx, ny),
        "apex": (ex + tx * L, ey + ty * L),
        "b1": (bxc + nx * hw, byc + ny * hw),
        "b2": (bxc - nx * hw, byc - ny * hw),
    }


def svg_with_size(svg_text: str, w: int, h: int) -> str:
    """把根 <svg> 的 width/height 改成渲染尺寸（viewBox 不变，几何不变）。"""
    return re.sub(
        r'(<svg\b[^>]*?)\bwidth="[^"]*"\s+height="[^"]*"',
        lambda m: m.group(1) + 'width="%d" height="%d"' % (w, h),
        svg_text,
        count=1,
    )


# ---------------------------------------------------------------------------
# 徽章 SVG
# ---------------------------------------------------------------------------
def _sphere_gradient(bid: str, b: dict) -> str:
    cx, cy, r = b["cx"], b["cy"], b["r"]
    hx, hy = cx + SPHERE_HIGHLIGHT[0] * r, cy + SPHERE_HIGHLIGHT[1] * r
    stops = "".join(
        '      <stop offset="%s" stop-color="%s"/>\n' % (n(off), color)
        for off, color in SPHERE_STOPS
    )
    return (
        '    <radialGradient id="ce-sphere-%s" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s">\n%s    </radialGradient>\n'
        % (bid, n(hx), n(hy), n(r * SPHERE_HIGHLIGHT[2]), stops)
    )


def _glow_gradient(bid: str, b: dict) -> str:
    strength = ARC["glow_strength"]
    rg = b["glow_r"]
    stops = GLOW_STOPS
    body = "".join(
        '      <stop offset="%s" stop-color="#C9D6E6" stop-opacity="%s"/>\n'
        % (n(off), n(alpha * strength))
        for off, alpha in stops
    )
    return (
        '    <radialGradient id="ce-glow-%s" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s">\n%s    </radialGradient>\n'
        % (bid, n(b["cx"]), n(b["cy"]), n(rg), body)
    )


def build_emblem_svg(with_bg: bool = True) -> str:
    for b in TRIO.values():
        b["glow_r"] = ARC["glow_k"] * b["r"]
    ag = arrow_geometry()
    bx, by = ARC["cx"], ARC["cy"]
    R, w, half = ARC["R"], ARC["w"], ARC["half_span"]

    defs = []
    for bid, b in TRIO.items():
        defs.append(_sphere_gradient(bid, b))
        defs.append(_glow_gradient(bid, b))

    # 轨道弧辉光：以重心为圆心的径向渐变正好垂直于弧线，得到均匀的柔光带
    glow_outer = R + w / 2.0 + 86.0
    arc_glow_stops = [
        (R - 92.0, 0.0),
        (R - 58.0, 0.05),
        (R - 29.0, 0.12),
        (R, 0.18),
        (R + 29.0, 0.10),
        (R + 58.0, 0.035),
        (glow_outer, 0.0),
    ]
    defs.append(
        '    <radialGradient id="ce-arc-glow" gradientUnits="userSpaceOnUse" cx="%s" cy="%s" r="%s">\n%s    </radialGradient>\n'
        % (
            n(bx),
            n(by),
            n(glow_outer),
            "".join(
                '      <stop offset="%s" stop-color="#AEBCCD" stop-opacity="%s"/>\n'
                % (n(rr / glow_outer), n(a))
                for rr, a in arc_glow_stops
            ),
        )
    )

    # 轨道弧金属渐变：左端暗钢 -> 右端冰白（向箭头/存续方向变亮）
    left = polar(bx, by, R, 90.0 + half)
    arc_stops = "".join(
        '      <stop offset="%s" stop-color="%s"/>\n' % (n(off), color)
        for off, color in ARC_METAL_STOPS
    )
    defs.append(
        '    <linearGradient id="ce-arc-metal" gradientUnits="userSpaceOnUse" x1="%s" y1="%s" x2="%s" y2="%s">\n%s    </linearGradient>\n'
        % (n(left[0]), n(left[1]), n(ag["apex"][0]), n(ag["apex"][1]), arc_stops)
    )

    # 箭头渐变：沿切线方向很弱的明暗（底边与弧端亮度接近，避免“折纸”式硬接缝）
    arrow_stops = "".join(
        '      <stop offset="%s" stop-color="%s"/>\n' % (n(off), color)
        for off, color in ARROW_STOPS
    )
    defs.append(
        '    <linearGradient id="ce-arrow-metal" gradientUnits="userSpaceOnUse" x1="%s" y1="%s" x2="%s" y2="%s">\n%s    </linearGradient>\n'
        % (n(ag["base"][0]), n(ag["base"][1]), n(ag["apex"][0]), n(ag["apex"][1]), arrow_stops)
    )

    body = []
    if with_bg:
        body.append('  <rect id="emblem-bg" width="1024" height="1024" fill="#000000"/>\n')
    body.append('  <g id="council-emblem">\n')
    # 1) 轨道弧辉光 + 弧体
    body.append('    <path id="orbit-arc-glow" d="%s" fill="url(#ce-arc-glow)"/>\n'
                % arc_band_path(bx, by, R, half, w + 2 * 86.0))
    body.append('    <path id="orbit-arc" d="%s" fill="url(#ce-arc-metal)"/>\n'
                % arc_band_path(bx, by, R, half, w))
    # 弧内缘一条 1.8 宽的高光细线（统一线宽，给金属厚度）
    ri_hl = R - w / 2.0 + 2.2
    th_a, th_b = 90.0 + half, 90.0 - half
    p_a = polar(bx, by, ri_hl, th_a)
    p_b = polar(bx, by, ri_hl, th_b)
    body.append('    <path d="M %s A %s %s 0 0 0 %s" stroke="#FFFFFF" stroke-opacity="%s" stroke-width="%s" fill="none"/>\n'
                % (pstr(p_a), n(ri_hl), n(ri_hl), pstr(p_b), n(ARC_HIGHLIGHT["opacity"]), n(ARC_HIGHLIGHT["width"])))
    # 2) 箭头
    body.append('    <polygon id="orbit-arrow" points="%s %s %s" fill="url(#ce-arrow-metal)"/>\n'
                % (pstr(ag["apex"]), pstr(ag["b1"]), pstr(ag["b2"])))
    # 3) 天体辉光 + 天体
    for bid, b in TRIO.items():
        body.append('    <circle id="body-glow-%s" cx="%s" cy="%s" r="%s" fill="url(#ce-glow-%s)"/>\n'
                    % (bid, n(b["cx"]), n(b["cy"]), n(b["glow_r"]), bid))
    for bid, b in TRIO.items():
        body.append('    <g id="body-group-%s" opacity="%s">\n'
                    % (bid, n(BODY_OPACITY[bid])))
        body.append('      <circle id="body-%s" cx="%s" cy="%s" r="%s" fill="url(#ce-sphere-%s)"/>\n'
                    % (bid, n(b["cx"]), n(b["cy"]), n(b["r"]), bid))
        body.append('    <circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-opacity="%s" stroke-width="%s"/>\n'
                    % (n(b["cx"]), n(b["cy"]), n(b["r"]), RIM_STROKE["color"],
                       n(RIM_STROKE["opacity"]), n(RIM_STROKE["width"])))
        # 右下边缘的受光轮廓线（天体“亮边”，增加金属/球体体积感）
        if RIM_LIGHT["opacity"] > 0:
            rl = b["r"] - 1.6
            ra = polar(b["cx"], b["cy"], rl, RIM_LIGHT["a0"])
            rb = polar(b["cx"], b["cy"], rl, RIM_LIGHT["a1"])
            body.append('      <path d="M %s A %s %s 0 0 1 %s" stroke="%s" stroke-opacity="%s" stroke-width="%s" stroke-linecap="round" fill="none"/>\n'
                        % (pstr(ra), n(rl), n(rl), pstr(rb), RIM_LIGHT["color"],
                           n(RIM_LIGHT["opacity"]), n(RIM_LIGHT["width"])))
        body.append('    </g>\n')
    body.append('  </g>\n')

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" '
        'role="img" aria-label="纪元存续理事会徽章：三颗银白天体悬于月牙轨道弧之上，轨道末端箭头指向右上" '
        'shape-rendering="geometricPrecision">\n'
        '  <title>纪元存续理事会 / EPOCH CONTINUITY COUNCIL</title>\n'
        '  <desc>纯黑底色上的银白几何徽记：三颗大小递变的天体呈不等边三角形，下方粗月牙形轨道弧如托盘托举，右端箭头沿切线指向右上，象征观测三体、守护文明轨迹、向存续前进。</desc>\n'
        '  <defs>\n' + "".join(defs) + '  </defs>\n'
        + "".join(body) + '</svg>\n'
    )


# ---------------------------------------------------------------------------
# 徽记 SVG（小尺寸用：同构图、扁平银白、无辉光、无文字、透明底、紧凑 viewBox）
# ---------------------------------------------------------------------------
def emblem_geometry_bbox():
    xs, ys = [], []
    for b in TRIO.values():
        xs += [b["cx"] - b["r"], b["cx"] + b["r"]]
        ys += [b["cy"] - b["r"], b["cy"] + b["r"]]
    ro = ARC["R"] + ARC["w"] / 2.0
    for i in range(28, 153, 1):
        p = polar(ARC["cx"], ARC["cy"], ro, float(i))
        xs.append(p[0])
        ys.append(p[1])
    ag = arrow_geometry()
    for key in ("apex", "b1", "b2", "end"):
        xs.append(ag[key][0])
        ys.append(ag[key][1])
    return min(xs), min(ys), max(xs), max(ys)


def build_mark_svg():
    x0, y0, x1, y1 = emblem_geometry_bbox()
    pad = 26.0
    vx, vy = math.floor(x0 - pad), math.floor(y0 - pad)
    vw = math.ceil(x1 + pad) - vx
    vh = math.ceil(y1 + pad) - vy
    ag = arrow_geometry()
    bx, by, R, w, half = ARC["cx"], ARC["cy"], ARC["R"], ARC["w"], ARC["half_span"]
    parts = []
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="%d %d %d %d" fill="none" '
        'role="img" aria-label="纪元存续理事会徽记" shape-rendering="geometricPrecision">\n'
        % (vw, vh, vx, vy, vw, vh)
    )
    parts.append('  <title>纪元存续理事会徽记 / council emblem mark</title>\n')
    parts.append('  <desc>小尺寸徽记：三颗银白天体 + 月牙轨道弧 + 右上箭头；无辉光、无文字、透明底。</desc>\n')
    parts.append('  <g id="council-emblem-mark">\n')
    # 灰阶双背景友好：黑幕上呈银白、白纸上仍可辨识（26px 品牌位实测）
    parts.append('    <path d="%s" fill="#66717F"/>\n' % arc_band_path(bx, by, R, half, w))
    parts.append('    <polygon points="%s %s %s" fill="#D9E2EC"/>\n'
                 % (pstr(ag["apex"]), pstr(ag["b1"]), pstr(ag["b2"])))
    # A 最大、B 次、C 最小，扁平灰银（小尺寸下保证实心剪影清晰）
    for bid, b in TRIO.items():
        fill = "#B7C3D1" if bid != "C" else "#AAB7C6"
        parts.append('    <circle cx="%s" cy="%s" r="%s" fill="%s"/>\n'
                     % (n(b["cx"]), n(b["cy"]), n(b["r"]), fill))
    parts.append('  </g>\n</svg>\n')
    return "".join(parts), (vw, vh)


# ---------------------------------------------------------------------------
# 准星环 SVG（透明底、银白细线、正下方缺口、可旋转）
# ---------------------------------------------------------------------------
def build_reticle_svg() -> str:
    cx, cy = RETICLE["cx"], RETICLE["cy"]
    r_out = RETICLE["r_outer"]
    gap_half = RETICLE["gap_half"]
    col = COLORS["reticle"]
    parts = []
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" '
        'role="img" aria-label="启动准星环：银白细线同心环，正下方缺口" shape-rendering="geometricPrecision">\n'
    )
    parts.append('  <title>启动准星环 / startup reticle ring</title>\n')
    parts.append('  <desc>银白细线同心准星环，外环在正下方留有 24° 缺口；内层为刻度环与细虚线环，中心十字准星。适合慢速自转。</desc>\n')
    parts.append('  <g id="reticle-rotor">\n')

    # 外环（缺口 78°..102°，正下方 24°）
    a1 = 90.0 + gap_half  # 102° 起，顺时针画到 78°+360°
    p1 = polar(cx, cy, r_out, a1)
    p2 = polar(cx, cy, r_out, 90.0 - gap_half)  # 78° 终
    parts.append('    <path d="M %s A %s %s 0 1 1 %s" stroke="%s" stroke-opacity=".92" stroke-width="2.2"/>\n'
                 % (pstr(p1), n(r_out), n(r_out), pstr(p2), col))

    # 缺口两侧的短径向刻线
    for deg in (90.0 - gap_half, 90.0 + gap_half):
        pa = polar(cx, cy, r_out - 4.0, deg)
        pb = polar(cx, cy, r_out + 20.0, deg)
        parts.append('    <path d="M %s L %s" stroke="%s" stroke-opacity=".82" stroke-width="3"/>\n'
                     % (pstr(pa), pstr(pb), col))

    # 刻度环：每 6° 一格；每 30° 长刻度；避开下方缺口
    for deg in range(0, 360, 6):
        dist = abs(((deg - 90) + 180) % 360 - 180)
        if dist < gap_half + 2.0:
            continue
        if deg % 30 == 0:
            r1, r2, sw, op = 456.0, 430.0, 2.4, 0.85
        else:
            r1, r2, sw, op = 452.0, 440.0, 1.4, 0.48
        pa = polar(cx, cy, r1, float(deg))
        pb = polar(cx, cy, r2, float(deg))
        parts.append('    <path d="M %s L %s" stroke="%s" stroke-opacity="%s" stroke-width="%s"/>\n'
                     % (pstr(pa), pstr(pb), col, n(op), n(sw)))

    # 细虚线内环
    parts.append('    <circle cx="%s" cy="%s" r="408" stroke="%s" stroke-opacity=".38" stroke-width="1.3" stroke-dasharray="2.4 10.2"/>\n'
                 % (n(cx), n(cy), col))

    # 中心十字准星（四向细线）
    for deg in (0.0, 90.0, 180.0, 270.0):
        pa = polar(cx, cy, 150.0, deg)
        pb = polar(cx, cy, 398.0, deg)
        parts.append('    <path d="M %s L %s" stroke="%s" stroke-opacity=".26" stroke-width="1.3"/>\n'
                     % (pstr(pa), pstr(pb), col))

    # 中心小环 + 中心点
    parts.append('    <circle cx="%s" cy="%s" r="9" stroke="%s" stroke-opacity=".5" stroke-width="1.6"/>\n'
                 % (n(cx), n(cy), col))
    parts.append('    <circle cx="%s" cy="%s" r="2.2" fill="%s" fill-opacity=".75"/>\n'
                 % (n(cx), n(cy), col))
    parts.append('  </g>\n</svg>\n')
    return "".join(parts)


# ---------------------------------------------------------------------------
# Edge headless 渲染
# ---------------------------------------------------------------------------
def html_document(body: str, w: int, h: int, bg: str) -> str:
    css = (
        "html,body{margin:0;padding:0;width:%dpx;height:%dpx;overflow:hidden;background:%s;}"
        "svg{display:block;}"
        "canvas{position:absolute;left:0;top:0;}"
        % (w, h, bg)
    )
    return (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<title>startup art render</title><style>%s</style></head><body>%s</body></html>'
        % (css, body)
    )


EDGE_FLAGS = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--disable-extensions",
    "--disable-sync",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-breakpad",
    "--disable-crash-reporter",
    "--disable-domain-reliability",
    "--disable-client-side-phishing-detection",
    "--metrics-recording-only",
    "--mute-audio",
    "--force-device-scale-factor=1",
]


def _kill_tree(pid: int):
    try:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
    except Exception:
        pass


def _kill_stray_headless():
    """清理此前超时遗留的本脚本 headless Edge 进程（只匹配 dsh-startup-art 临时 profile）。"""
    try:
        ps = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | "
             "Where-Object { $_.CommandLine -match 'dsh-startup-art-' } | "
             "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=40)
    except Exception:
        pass


def render_with_edge(html: str, out_png: Path, w: int, h: int, transparent: bool, tag: str) -> dict:
    if not Path(EDGE).exists():
        raise SystemExit("找不到 Edge：%s（可用 EDGE_PATH 环境变量覆盖）" % EDGE)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    last_err = None
    for attempt in (1, 2, 3):
        if out_png.exists():
            out_png.unlink()
        work = Path(tempfile.mkdtemp(prefix="dsh-startup-art-%s-" % tag))
        try:
            page = work / "page.html"
            page.write_text(html, encoding="utf-8")
            profile = work / "edge-profile"
            args = [EDGE] + EDGE_FLAGS + [
                "--virtual-time-budget=1500",
                "--user-data-dir=%s" % profile,
                "--window-size=%d,%d" % (w, h),
                "--screenshot=%s" % out_png,
                "--default-background-color=%s" % ("00000000" if transparent else "FF000000"),
                page.as_uri(),
            ]
            t0 = time.time()
            proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                proc.wait(timeout=75)
            except subprocess.TimeoutExpired:
                _kill_tree(proc.pid)
                raise RuntimeError("Edge 渲染超时（75s）tag=%s attempt=%d" % (tag, attempt))
            dur = time.time() - t0
            if (not out_png.exists()) or out_png.stat().st_size < 512:
                raise RuntimeError("Edge 渲染失败 tag=%s attempt=%d" % (tag, attempt))
            return {"tag": tag, "out": str(out_png), "bytes": out_png.stat().st_size,
                    "seconds": round(dur, 2), "attempt": attempt}
        except Exception as exc:
            last_err = exc
            print("[warn] Edge 渲染重试 tag=%s attempt=%d: %s" % (tag, attempt, exc))
            if attempt == 1:
                _kill_stray_headless()
            time.sleep(1.5)
        finally:
            shutil.rmtree(work, ignore_errors=True)
    raise RuntimeError("Edge 渲染最终失败 tag=%s: %s" % (tag, last_err))


def write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# 自检（尺寸 / 非空 / 非全黑 / 覆盖率 / alpha / SVG 结构）
# ---------------------------------------------------------------------------
def analyze_svg(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    root = ET.fromstring(text)
    hrefs = re.findall(r'(?:href|xlink:href)="([^"]+)"', text)
    external = [u for u in hrefs if not u.startswith("#")]
    return {
        "file": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "root_tag": root.tag,
        "has_visible_text": ("<text" in text),
        "external_refs": external,
        "has_script": ("<script" in text),
    }


def analyze_black_png(path: Path) -> dict:
    if Image is None:
        return {"error": "Pillow 缺失，跳过像素自检"}
    im = Image.open(path).convert("RGB")
    w, h = im.size
    total = float(w * h)
    lum = im.convert("L")
    hist = lum.histogram()
    cum = [0] * 256
    acc = 0
    for i in range(255, -1, -1):
        acc += hist[i]
        cum[i] = acc

    def frac_above(t):
        return cum[min(255, t + 1)] / total

    px = im.load()
    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    border = [px[x, 1] for x in range(0, w, 97)] + [px[x, h - 2] for x in range(0, w, 97)]
    return {
        "file": str(path),
        "size": [w, h],
        "mode": im.mode,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "corners": corners,
        "pure_black_corners": all(max(c) <= 4 for c in corners),
        "border_max": max(max(c) for c in border),
        "coverage": {
            "luma>8": round(frac_above(8), 4),
            "luma>32": round(frac_above(32), 4),
            "luma>64": round(frac_above(64), 4),
            "luma>128": round(frac_above(128), 4),
            "luma>192": round(frac_above(192), 4),
        },
        "mean_luma": round(sum(i * hist[i] for i in range(256)) / total, 2),
    }


def analyze_transparent_png(path: Path) -> dict:
    if Image is None:
        return {"error": "Pillow 缺失，跳过像素自检"}
    im = Image.open(path)
    mode = im.mode
    im = im.convert("RGBA")
    w, h = im.size
    total = float(w * h)
    alpha = im.getchannel("A")
    hist = alpha.histogram()
    acc = 0
    cum = [0] * 256
    for i in range(255, -1, -1):
        acc += hist[i]
        cum[i] = acc

    def frac_above(t):
        return cum[min(255, t + 1)] / total

    px = im.load()
    corners = [px[2, 2][3], px[w - 3, 2][3], px[2, h - 3][3], px[w - 3, h - 3][3]]
    bbox = alpha.getbbox()
    return {
        "file": str(path),
        "size": [w, h],
        "mode": mode,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "alpha_extrema": list(alpha.getextrema()),
        "corner_alpha": corners,
        "content_bbox": list(bbox) if bbox else None,
        "coverage": {
            "alpha>0": round(frac_above(0), 4),
            "alpha>8": round(frac_above(8), 4),
            "alpha>64": round(frac_above(64), 4),
            "alpha>200": round(frac_above(200), 4),
        },
    }


# ---------------------------------------------------------------------------
# 预览
# ---------------------------------------------------------------------------
def make_checker_preview(src: Path, out: Path, size: int = 1024):
    im = Image.open(src).convert("RGBA").resize((size, size), Image.LANCZOS)
    sq = size // 16
    checker = Image.new("RGB", (size, size))
    for yy in range(0, size, sq):
        for xx in range(0, size, sq):
            c = (44, 44, 44) if ((xx // sq + yy // sq) % 2 == 0) else (72, 72, 72)
            checker.paste(c, (xx, yy, xx + sq, yy + sq))
    base = checker.convert("RGBA")
    base.alpha_composite(im)
    base.convert("RGB").save(out, optimize=True)


def crop_preview(src: Path, box, out: Path):
    im = Image.open(src).convert("RGB")
    im.crop(box).save(out, optimize=True)


def mark_strip_html(mark_svg: str, vw: int, vh: int) -> str:
    """小尺寸拼版：上排黑幕（启动 1/6 幕），下排纸白（启动 3–5 幕档案页），验证双背景可读性。"""
    heights = [192, 96, 48, 32, 26, 18]
    gap = 26
    widths = [int(round(h * vw / float(vh))) for h in heights]
    total_w = sum(widths) + gap * (len(heights) - 1) + 80
    page_w = max(860, total_w)
    row_black_top = 40
    row_paper_top = 300
    page_h = 556
    items = [
        '<div style="position:absolute;left:0;top:0;width:%dpx;height:280px;background:#000"></div>' % page_w,
        '<div style="position:absolute;left:0;top:280px;width:%dpx;height:276px;background:#F4F1EA"></div>' % page_w,
    ]
    for row_top, color in ((row_black_top, "#000"), (row_paper_top, "#F4F1EA")):
        x = 40
        for hh, ww in zip(heights, widths):
            scaled = svg_with_size(mark_svg, ww, hh)
            items.append(
                '<div style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx;background:%s">%s</div>'
                % (x, row_top, ww, hh, color, scaled)
            )
            x += ww + gap
    return html_document("".join(items), page_w, page_h, "#000000")


def sim_act1_html(emblem_transparent: str, reticle_svg: str) -> str:
    stars_js = """
<script>
(function(){
  var c = document.getElementById('stars');
  var ctx = c.getContext('2d');
  var seed = 20261121;
  function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (var i = 0; i < 260; i++) {
    var x = rnd() * 1600, y = rnd() * 900;
    var r = rnd() < 0.86 ? 0.55 : 1.35;
    var a = 0.02 + rnd() * 0.10;
    ctx.fillStyle = 'rgba(198,214,236,' + a.toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28318); ctx.fill();
  }
})();
</script>
"""
    emblem = svg_with_size(emblem_transparent, 620, 620)
    reticle = svg_with_size(reticle_svg, 780, 780)
    body = (
        '<canvas id="stars" width="1600" height="900"></canvas>'
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
        '<div style="position:relative;width:820px;height:820px;display:flex;align-items:center;justify-content:center">'
        '<div style="position:absolute;width:780px;height:780px;opacity:.5;transform:rotate(16deg)">%s</div>'
        '<div style="position:relative;width:620px;height:620px">%s</div>'
        '</div></div>%s'
        % (reticle, emblem, stars_js)
    )
    return html_document(body, 1600, 900, "#000000")


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="生成「纪元存续理事会」启动徽章资产")
    ap.add_argument("--quick", action="store_true", help="只写 SVG + 2048 黑底渲染并测量")
    ap.add_argument("--no-edge", action="store_true", help="只写 SVG，不渲染 PNG/预览")
    args = ap.parse_args()

    PUB = PUBLIC_DIR
    ART = ARTIFACT_DIR
    PUB.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)

    # 主 SVG 透明底：启动动画把它放在纯黑幕 + CSS 光晕之上，带黑底矩形会出现可见方块；
    # 纯黑底由 council-emblem-2048-black.png 提供（渲染时页面底色 #000）。
    emblem_svg = build_emblem_svg(with_bg=False)
    emblem_transparent_svg = build_emblem_svg(with_bg=False)
    mark_svg, (mark_vw, mark_vh) = build_mark_svg()
    reticle_svg = build_reticle_svg()

    assets = {
        PUB / "council-emblem.svg": emblem_svg,
        PUB / "council-emblem-mark.svg": mark_svg,
        PUB / "reticle-ring.svg": reticle_svg,
    }
    written = {}
    for path, text in assets.items():
        write_text(path, XML_DECL + text)
        written[str(path)] = {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
        print("[write] %-56s %6d B" % (path.relative_to(ROOT), path.stat().st_size))

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "generator": str(Path(__file__).relative_to(ROOT)),
        "design": {
            "canvas": [1024, 1024],
            "bodies": {k: {"cx": v["cx"], "cy": v["cy"], "r": v["r"]} for k, v in TRIO.items()},
            "barycenter": list(BARY),
            "orbit_arc": {k: ARC[k] for k in ("R", "half_span", "w", "arrow_len", "arrow_half")},
        },
        "svg": {
            "council-emblem.svg": analyze_svg(PUB / "council-emblem.svg"),
            "council-emblem-mark.svg": analyze_svg(PUB / "council-emblem-mark.svg"),
            "reticle-ring.svg": analyze_svg(PUB / "reticle-ring.svg"),
        },
        "written": written,
    }

    if args.no_edge:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return

    t_start = time.time()
    print("\n[render] 2048×2048 黑底（Edge headless）…")
    black_png = PUB / "council-emblem-2048-black.png"
    render_with_edge(
        html_document(svg_with_size(emblem_svg, 2048, 2048), 2048, 2048, "#000000"),
        black_png, 2048, 2048, False, "black2048",
    )
    report["png_black_2048"] = analyze_black_png(black_png)
    cov = report["png_black_2048"].get("coverage", {})
    print("[ok] black 2048: size=%s coverage(luma>8)=%s solid(luma>128)=%s mean=%s"
          % (report["png_black_2048"].get("size"), cov.get("luma>8"), cov.get("luma>128"),
             report["png_black_2048"].get("mean_luma")))

    if args.quick:
        print("\n[quick] 跳过透明 PNG 与预览。用时 %.1fs" % (time.time() - t_start))
        write_text(ART / "report.json", json.dumps(report, indent=2, ensure_ascii=False))
        return

    print("[render] 2048×2048 透明底（RGBA）…")
    transparent_png = PUB / "council-emblem-2048-transparent.png"
    render_with_edge(
        html_document(svg_with_size(emblem_transparent_svg, 2048, 2048), 2048, 2048, "transparent"),
        transparent_png, 2048, 2048, True, "transparent2048",
    )
    report["png_transparent_2048"] = analyze_transparent_png(transparent_png)
    tcov = report["png_transparent_2048"].get("coverage", {})
    print("[ok] transparent 2048: alpha=%s coverage(alpha>8)=%s"
          % (report["png_transparent_2048"].get("alpha_extrema"), tcov.get("alpha>8")))

    # ---- 预览渲染 ----
    print("[preview] 1024 黑底主徽章…")
    render_with_edge(
        html_document(svg_with_size(emblem_svg, 1024, 1024), 1024, 1024, "#000000"),
        ART / "preview-emblem-1024-black.png", 1024, 1024, False, "preview1024",
    )

    print("[preview] 准星环 1024 黑底…")
    render_with_edge(
        html_document(svg_with_size(reticle_svg, 1024, 1024), 1024, 1024, "#000000"),
        ART / "preview-reticle-1024-black.png", 1024, 1024, False, "reticle1024",
    )

    print("[preview] 小尺寸徽记（黑幕 + 纸白双背景，18–192 px）…")
    render_with_edge(
        mark_strip_html(mark_svg, mark_vw, mark_vh),
        ART / "preview-mark-sizes.png", 860, 556, False, "markstrip",
    )

    print("[preview] 幕 1 合成示意（1600×900：极淡星点 + 准星环 + 透明徽章）…")
    render_with_edge(
        sim_act1_html(emblem_transparent_svg, reticle_svg),
        ART / "preview-startup-act1-sim-1600x900.png", 1600, 900, False, "sim1600",
    )

    # ---- 200% 裁切（2048 渲染原生像素 = 设计尺寸的 200%） ----
    if Image is not None:
        crop_preview(black_png, (328, 330, 1048, 1050), ART / "preview-zoom200-body-A.png")
        crop_preview(black_png, (1328, 880, 2048, 1600), ART / "preview-zoom200-arrow.png")
        make_checker_preview(transparent_png, ART / "preview-transparent-on-checker.png", 1024)

    # ---- 自检断言 ----
    problems = []
    bcov = report["png_black_2048"].get("coverage", {})
    if not report["png_black_2048"].get("pure_black_corners"):
        problems.append("黑底 PNG 四角不是纯黑")
    if not (0.30 <= bcov.get("luma>8", 0) <= 0.40):
        problems.append("银白主体覆盖率 %.1f%% 不在 30–40%% 区间（阈值 luma>8）" % (100 * bcov.get("luma>8", 0)))
    tr = report["png_transparent_2048"]
    if tr.get("alpha_extrema") != [0, 255]:
        problems.append("透明 PNG alpha 未覆盖 0–255：%s" % (tr.get("alpha_extrema"),))
    if any(a != 0 for a in tr.get("corner_alpha", [1])):
        problems.append("透明 PNG 四角 alpha 非 0：%s" % (tr.get("corner_alpha"),))
    for key in ("council-emblem.svg", "council-emblem-mark.svg", "reticle-ring.svg"):
        sv = report["svg"][key]
        if sv.get("has_visible_text"):
            problems.append("%s 含 <text>（不应有可见文字）" % key)
        if sv.get("external_refs"):
            problems.append("%s 含外部引用：%s" % (key, sv["external_refs"]))
    report["check"] = {"problems": problems, "pass": not problems}

    write_text(ART / "report.json", json.dumps(report, indent=2, ensure_ascii=False))
    print("\n[report] %s" % (ART / "report.json").relative_to(ROOT))
    if problems:
        print("[FAIL] " + "；".join(problems))
        raise SystemExit(1)
    print("[PASS] 全部自检通过（覆盖率 %.1f%%，用时 %.1fs）"
          % (100 * bcov.get("luma>8", 0), time.time() - t_start))


if __name__ == "__main__":
    main()
