#!/usr/bin/env python3
"""Google Workspace Marketplace 用のアセット画像を生成するスクリプト。

生成物:
  - icon_32.png       32x32   アプリアイコン
  - icon_128.png      128x128 アプリアイコン
  - banner_220x140.png 220x140 プロモーションバナー
  - screenshot.png    1280x800 機能イメージ（スクリーンショット代替）

依存: Pillow
実行: python3 assets/generate_assets.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = "/mnt/skills/examples/canvas-design/canvas-fonts"
JP_FONT = "/etc/alternatives/fonts-japanese-gothic.ttf"

BLUE = (26, 115, 232)        # Google blue #1a73e8
BLUE_DARK = (21, 87, 176)    # #1557b0
WHITE = (255, 255, 255)
GRAY_LINE = (218, 220, 224)  # #dadce0
GRAY_TEXT = (95, 99, 104)    # #5f6368
SELECT = (197, 220, 252)     # selection highlight
SELECT_SOFT = (232, 240, 254)  # #e8f0fe
GREEN = (24, 128, 56)        # #188038


def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


def jpfont(size):
    return ImageFont.truetype(JP_FONT, size)


def rounded_mask(size, radius):
    """size=(w,h) の角丸マスク(L)を返す。"""
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def vertical_gradient(size, top, bottom):
    """上から下への線形グラデーション画像(RGBA)。"""
    w, h = size
    base = Image.new("RGBA", size)
    px = base.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b, 255)
    return base


def draw_glyph(S):
    """一辺 S のアイコン本体(RGBA)を高解像度で描く。

    青い角丸の地に白いドキュメント、その中の1行を選択ハイライトし、
    波括弧 { } で「選択範囲に名前を付ける」ことを表現する。
    """
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # 背景: 青の角丸 + グラデーション
    grad = vertical_gradient((S, S), BLUE, BLUE_DARK)
    img.paste(grad, (0, 0), rounded_mask((S, S), int(S * 0.22)))

    d = ImageDraw.Draw(img)

    # ドキュメント(白い角丸)
    dw, dh = int(S * 0.46), int(S * 0.60)
    dx = (S - dw) // 2
    dy = (S - dh) // 2
    d.rounded_rectangle([dx, dy, dx + dw, dy + dh], radius=int(S * 0.04), fill=WHITE)

    # 本文の行
    pad = int(dw * 0.16)
    line_x0 = dx + pad
    line_x1 = dx + dw - pad
    lh = int(dh * 0.105)
    gap = int(dh * 0.075)
    y = dy + int(dh * 0.16)
    rows = []
    for i in range(4):
        rows.append(y)
        y += lh + gap

    # 通常行(グレー)
    for i, ry in enumerate(rows):
        x1 = line_x1 if i != 3 else line_x0 + int((line_x1 - line_x0) * 0.6)
        d.rounded_rectangle([line_x0, ry, x1, ry + lh], radius=lh // 2, fill=GRAY_LINE)

    # 2行目を選択ハイライト(青)に置き換え、青い波括弧 { } で囲んで
    # 「選択範囲に名前を付ける」ことを表現する。
    sel = rows[1]
    d.rounded_rectangle(
        [line_x0 - int(pad * 0.30), sel - int(lh * 0.55),
         line_x1 + int(pad * 0.30), sel + lh + int(lh * 0.55)],
        radius=lh, fill=SELECT_SOFT,
    )

    # 波括弧(青・太字)。高さは選択行より大きめにして視認性を確保する。
    br_font = font("WorkSans-Bold.ttf", int(lh * 3.0))
    lb_w = d.textlength("{", font=br_font)
    rb_w = d.textlength("}", font=br_font)
    by = sel + lh // 2
    d.text((line_x0, by), "{", font=br_font, fill=BLUE, anchor="lm")
    d.text((line_x1, by), "}", font=br_font, fill=BLUE, anchor="rm")

    # 括弧の内側に青い選択バーを描く
    bar_x0 = int(line_x0 + lb_w + lh * 0.5)
    bar_x1 = int(line_x1 - rb_w - lh * 0.5)
    d.rounded_rectangle([bar_x0, sel, bar_x1, sel + lh], radius=lh // 2, fill=BLUE)

    return img


def make_icon(px):
    SS = 8
    glyph = draw_glyph(px * SS)
    return glyph.resize((px, px), Image.LANCZOS)


def make_banner():
    SS = 3
    W, H = 220 * SS, 140 * SS
    img = vertical_gradient((W, H), BLUE, BLUE_DARK)
    d = ImageDraw.Draw(img)

    # 左にアイコングリフ
    g = 92 * SS
    glyph = draw_glyph(g)
    gx, gy = 16 * SS, (H - g) // 2
    img.paste(glyph, (gx, gy), glyph)

    # 右にテキスト
    tx = gx + g + 14 * SS
    title_f = font("WorkSans-Bold.ttf", 26 * SS)
    sub_f = jpfont(13 * SS)
    d.text((tx, 50 * SS), "Named", font=title_f, fill=WHITE, anchor="lm")
    d.text((tx, 78 * SS), "Range", font=title_f, fill=WHITE, anchor="lm")
    d.text((tx, 102 * SS), "Google Docs ツール", font=sub_f, fill=(220, 230, 250), anchor="lm")

    return img.resize((220, 140), Image.LANCZOS)


def make_screenshot():
    SS = 2
    W, H = 1280 * SS, 800 * SS
    img = Image.new("RGBA", (W, H), (241, 243, 244, 255))
    d = ImageDraw.Draw(img)

    def F(name, size):
        return font(name, size * SS)

    def JF(size):
        return jpfont(size * SS)

    # ===== 上部: Docs 風ツールバー =====
    d.rectangle([0, 0, W, 64 * SS], fill=WHITE)
    d.line([0, 64 * SS, W, 64 * SS], fill=GRAY_LINE, width=1 * SS)
    # ドキュメントタイトル
    d.text((28 * SS, 20 * SS), "提案書", font=JF(20), fill=(60, 64, 67), anchor="lm")
    # メニュー
    menu_f = JF(15)
    menus = ["ファイル", "編集", "表示", "挿入", "表示形式", "ツール", "拡張機能"]
    mx = 28 * SS
    my = 46 * SS
    ext_box = None
    for m in menus:
        bbox = d.textbbox((mx, my), m, font=menu_f, anchor="lm")
        if m == "拡張機能":
            ext_box = (bbox[0] - 8 * SS, 34 * SS, bbox[2] + 8 * SS, 60 * SS)
            d.rounded_rectangle(ext_box, radius=4 * SS, fill=SELECT_SOFT)
        d.text((mx, my), m, font=menu_f, fill=GRAY_TEXT, anchor="lm")
        mx = bbox[2] + 22 * SS

    # ===== 拡張機能メニューのドロップダウン =====
    dd_x0 = ext_box[0]
    dd_y0 = 64 * SS
    dd_w = 300 * SS
    dd = [dd_x0, dd_y0, dd_x0 + dd_w, dd_y0 + 96 * SS]
    d.rounded_rectangle(dd, radius=6 * SS, fill=WHITE, outline=GRAY_LINE, width=1 * SS)
    item_f = JF(15)
    d.rounded_rectangle([dd_x0 + 6 * SS, dd_y0 + 8 * SS, dd_x0 + dd_w - 6 * SS, dd_y0 + 44 * SS],
                        radius=4 * SS, fill=SELECT_SOFT)
    d.text((dd_x0 + 18 * SS, dd_y0 + 26 * SS), "Named Range ツール",
           font=item_f, fill=(60, 64, 67), anchor="lm")
    d.text((dd_x0 + 34 * SS, dd_y0 + 66 * SS), "選択範囲を名前付き範囲に設定",
           font=item_f, fill=BLUE, anchor="lm")

    # ===== ドキュメント本文(白い紙) =====
    page = [200 * SS, 120 * SS, W - 200 * SS, H - 40 * SS]
    d.rectangle(page, fill=WHITE)
    # 影風の枠
    d.rectangle([page[0], page[1], page[2], page[1] + 2 * SS], fill=GRAY_LINE)

    px0 = page[0] + 70 * SS
    px1 = page[2] - 70 * SS
    py = page[1] + 70 * SS

    d.text((px0, py), "四半期レポート", font=JF(30), fill=(32, 33, 36), anchor="lm")
    py += 70 * SS

    body_f = JF(17)
    lines = [
        "本ドキュメントでは、対象期間における主要な指標をまとめる。",
        "特に重要な箇所は名前付き範囲として登録し、後から参照しやすくする。",
        "",
        "売上は前年同期比で着実に成長しており、来期の見通しも良好である。",
    ]
    # 選択ハイライトする語
    sel_line_idx = 1
    sel_word = "名前付き範囲"
    for i, ln in enumerate(lines):
        if i == sel_line_idx and sel_word in ln:
            before = ln.split(sel_word)[0]
            x_before = d.textlength(before, font=body_f)
            x_word = d.textlength(sel_word, font=body_f)
            d.rectangle([px0 + x_before, py - 4 * SS, px0 + x_before + x_word, py + 26 * SS],
                        fill=SELECT)
        d.text((px0, py), ln, font=body_f, fill=(60, 64, 67), anchor="lm")
        py += 40 * SS

    # ===== モーダルダイアログ =====
    dw, dh = 440 * SS, 210 * SS
    dx0 = (W - dw) // 2
    dy0 = (H - dh) // 2 + 40 * SS
    # 影
    d.rounded_rectangle([dx0 + 6 * SS, dy0 + 8 * SS, dx0 + dw + 6 * SS, dy0 + dh + 8 * SS],
                        radius=12 * SS, fill=(0, 0, 0, 40))
    d.rounded_rectangle([dx0, dy0, dx0 + dw, dy0 + dh], radius=12 * SS,
                        fill=WHITE, outline=GRAY_LINE, width=1 * SS)
    d.text((dx0 + 28 * SS, dy0 + 34 * SS), "名前付き範囲の設定",
           font=JF(19), fill=(32, 33, 36), anchor="lm")
    d.text((dx0 + 28 * SS, dy0 + 74 * SS), "名前付き範囲の名前",
           font=JF(13), fill=GRAY_TEXT, anchor="lm")
    # 入力欄(初期値=選択テキスト)
    in_box = [dx0 + 28 * SS, dy0 + 90 * SS, dx0 + dw - 28 * SS, dy0 + 124 * SS]
    d.rounded_rectangle(in_box, radius=5 * SS, fill=WHITE, outline=BLUE, width=2 * SS)
    d.text((in_box[0] + 12 * SS, (in_box[1] + in_box[3]) // 2), "名前付き範囲",
           font=JF(15), fill=(32, 33, 36), anchor="lm")
    # ボタン
    ok_w = 70 * SS
    ok = [dx0 + dw - 28 * SS - ok_w, dy0 + dh - 50 * SS,
          dx0 + dw - 28 * SS, dy0 + dh - 18 * SS]
    d.rounded_rectangle(ok, radius=5 * SS, fill=BLUE)
    d.text(((ok[0] + ok[2]) // 2, (ok[1] + ok[3]) // 2), "OK",
           font=F("WorkSans-Bold.ttf", 14), fill=WHITE, anchor="mm")
    cancel = [ok[0] - 12 * SS - 96 * SS, ok[1], ok[0] - 12 * SS, ok[3]]
    d.rounded_rectangle(cancel, radius=5 * SS, fill=(241, 243, 244, 255))
    d.text(((cancel[0] + cancel[2]) // 2, (cancel[1] + cancel[3]) // 2), "キャンセル",
           font=JF(13), fill=(60, 64, 67), anchor="mm")

    return img.resize((1280, 800), Image.LANCZOS).convert("RGB")


def main():
    make_icon(32).save(os.path.join(HERE, "icon_32.png"))
    make_icon(128).save(os.path.join(HERE, "icon_128.png"))
    make_banner().save(os.path.join(HERE, "banner_220x140.png"))
    make_screenshot().save(os.path.join(HERE, "screenshot.png"))
    print("generated: icon_32.png, icon_128.png, banner_220x140.png, screenshot.png")


if __name__ == "__main__":
    main()
