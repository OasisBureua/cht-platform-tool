#!/usr/bin/env python3
"""Generate PDF from CHT Platform markdown reports (assessment, auth decoupling, etc.)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MD = ROOT / "docs/reports/CHT-Platform-Assessment-Report.md"
DEFAULT_PDF = ROOT / "docs/reports/CHT-Platform-Assessment-Report.pdf"


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_md(text: str) -> str:
    text = esc(text.strip())
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r"<font face='Courier' size='7'>\1</font>", text)
    return text


def parse_table(lines: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in lines:
        if not line.strip().startswith("|"):
            break
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.match(r"^[-:\s]+$", c) for c in cells):
            continue
        rows.append(cells)
    return rows


class StoryBuilder:
    def __init__(self, styles: dict) -> None:
        self.story: list = []
        self.styles = styles
        self._last_kind: str | None = None

    def _gap(self, size: float, kind: str = "gap") -> None:
        if self._last_kind == kind:
            return
        self.story.append(Spacer(1, size))
        self._last_kind = kind

    def _flow(self, flowable, kind: str) -> None:
        self.story.append(flowable)
        self._last_kind = kind

    def blank_line(self) -> None:
        self._gap(0.06 * inch, "blank")

    def hr(self) -> None:
        self._gap(0.14 * inch, "pre_hr")
        self._flow(
            HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")),
            "hr",
        )
        self._gap(0.14 * inch, "post_hr")

    def table(self, rows: list[list[str]], col_count: int) -> None:
        if not rows:
            return
        normalized = [r + [""] * (col_count - len(r)) for r in rows]
        usable_width = letter[0] - 1.5 * inch
        col_w = usable_width / col_count
        cell_style = self.styles["TableCell"]
        header_style = self.styles["TableHeader"]

        table_data: list[list] = []
        for ri, row in enumerate(normalized):
            style = header_style if ri == 0 else cell_style
            table_data.append([Paragraph(inline_md(c), style) for c in row])

        t = Table(table_data, colWidths=[col_w] * col_count, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d0d0d0")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f7f9fb")],
                    ),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        self._gap(0.1 * inch, "pre_table")
        self._flow(t, "table")
        self._gap(0.16 * inch, "post_table")

    def title(self, text: str) -> None:
        self._gap(0.05 * inch, "pre_title")
        self._flow(Paragraph(inline_md(text), self.styles["Title"]), "title")
        self._gap(0.12 * inch, "post_title")

    def h1(self, text: str) -> None:
        if text.strip().lower() == "technical review":
            self._flow(PageBreak(), "pagebreak")
        self._gap(0.22 * inch, "pre_h1")
        self._flow(Paragraph(inline_md(text), self.styles["Heading1"]), "h1")

    def h2(self, text: str) -> None:
        self._gap(0.14 * inch, "pre_h2")
        self._flow(Paragraph(inline_md(text), self.styles["Heading2"]), "h2")

    def meta(self, text: str) -> None:
        self._flow(Paragraph(inline_md(text), self.styles["Meta"]), "meta")

    def body(self, text: str) -> None:
        self._flow(Paragraph(inline_md(text), self.styles["Body"]), "body")

    def bullet(self, text: str) -> None:
        self._flow(Paragraph(f"• {inline_md(text)}", self.styles["Bullet"]), "bullet")

    def numbered(self, text: str) -> None:
        self._flow(Paragraph(inline_md(text), self.styles["Numbered"]), "numbered")

    def checklist(self, text: str, done: bool) -> None:
        mark = "☑" if done else "☐"
        self._flow(
            Paragraph(f"{mark} {inline_md(text)}", self.styles["Bullet"]),
            "checklist",
        )

    def code_line(self, text: str) -> None:
        self._flow(
            Paragraph(
                f"<font face='Courier' size='7'>{esc(text)}</font>",
                self.styles["Code"],
            ),
            "code",
        )

    def code_block(self, lines: list[str]) -> None:
        block = [
            Paragraph(
                f"<font face='Courier' size='7'>{esc(line)}</font>",
                self.styles["Code"],
            )
            for line in lines
        ]
        self._gap(0.08 * inch, "pre_code")
        self._flow(KeepTogether(block), "code_block")
        self._gap(0.12 * inch, "post_code")


def build_story(md_path: Path, styles: dict) -> list:
    b = StoryBuilder(styles)
    lines = md_path.read_text(encoding="utf-8").splitlines()
    i = 0
    in_code = False
    code_buf: list[str] = []
    skip_next_blank = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            if in_code:
                b.code_block(code_buf)
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if not stripped:
            if not skip_next_blank:
                b.blank_line()
            skip_next_blank = False
            i += 1
            continue

        skip_next_blank = False

        if stripped == "---":
            b.hr()
            i += 1
            continue

        if stripped.startswith("|"):
            table_lines: list[str] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = parse_table(table_lines)
            if rows:
                col_count = max(len(r) for r in rows)
                b.table(rows, col_count)
            continue

        if stripped.startswith("# "):
            b.title(stripped[2:])
            i += 1
            continue

        if stripped.startswith("## "):
            b.h1(stripped[3:])
            i += 1
            continue

        if stripped.startswith("### "):
            b.h2(stripped[4:])
            i += 1
            continue

        if stripped.startswith("- [x] "):
            b.checklist(stripped[6:], done=True)
            i += 1
            continue

        if stripped.startswith("- [ ] "):
            b.checklist(stripped[6:], done=False)
            i += 1
            continue

        if stripped.startswith("- "):
            b.bullet(stripped[2:])
            i += 1
            continue

        if re.match(r"^\d+\.\s", stripped):
            b.numbered(stripped)
            i += 1
            continue

        # Subtitle / metadata lines right after title (bold label lines)
        if stripped.startswith("**") and stripped.endswith("**") and ":" in stripped:
            b.meta(stripped)
            i += 1
            continue

        b.body(stripped)
        i += 1

    return b.story


def make_styles():
    base = getSampleStyleSheet()
    return {
        "Title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=19,
            leading=23,
            textColor=colors.HexColor("#1e3a5f"),
            spaceAfter=0,
            spaceBefore=0,
        ),
        "Meta": ParagraphStyle(
            "Meta",
            parent=base["BodyText"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#444444"),
            spaceBefore=0,
            spaceAfter=2,
            leftIndent=0,
        ),
        "Heading1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#1e3a5f"),
            spaceBefore=0,
            spaceAfter=8,
            keepWithNext=True,
        ),
        "Heading2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            textColor=colors.HexColor("#2d5986"),
            spaceBefore=0,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontSize=9,
            leading=13,
            alignment=TA_JUSTIFY,
            spaceBefore=0,
            spaceAfter=6,
        ),
        "Bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontSize=9,
            leading=13,
            leftIndent=12,
            bulletIndent=0,
            spaceBefore=0,
            spaceAfter=3,
        ),
        "Numbered": ParagraphStyle(
            "Numbered",
            parent=base["BodyText"],
            fontSize=9,
            leading=13,
            leftIndent=12,
            spaceBefore=0,
            spaceAfter=4,
        ),
        "Code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontSize=7,
            leading=9,
            leftIndent=8,
            backColor=colors.HexColor("#f4f4f4"),
            spaceBefore=0,
            spaceAfter=0,
        ),
        "TableHeader": ParagraphStyle(
            "TableHeader",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.white,
            alignment=TA_LEFT,
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=base["BodyText"],
            fontSize=8,
            leading=10.5,
            alignment=TA_LEFT,
            wordWrap="CJK",
        ),
    }


def report_title_from_md(md_path: Path) -> str:
    for line in md_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return md_path.stem.replace("-", " ")


def main() -> int:
    md_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_MD
    pdf_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PDF

    if not md_path.exists():
        print(f"Missing markdown: {md_path}", file=sys.stderr)
        return 1

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    if pdf_path.exists():
        pdf_path.unlink()

    report_title = report_title_from_md(md_path)
    styles = make_styles()
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.85 * inch,
        title=report_title,
        author="CHT Engineering",
    )

    def on_page(canvas, doc_obj):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#888888"))
        canvas.drawString(
            0.85 * inch,
            0.55 * inch,
            report_title,
        )
        canvas.drawRightString(
            letter[0] - 0.85 * inch,
            0.55 * inch,
            f"Page {doc_obj.page}",
        )
        canvas.restoreState()

    story = build_story(md_path, styles)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {pdf_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
