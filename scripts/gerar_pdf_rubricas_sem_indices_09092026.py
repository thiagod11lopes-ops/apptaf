"""PDF só do dia 09/09/2026: rúbrica sem tempo/nota/Aprovado/Reprovado."""

from __future__ import annotations

import csv
import re
from io import StringIO
from pathlib import Path

from fpdf import FPDF

DOWNLOADS = Path.home() / "Downloads"
DESKTOP = Path.home() / "Desktop"
OUT_PDF = DESKTOP / "Rubricas_sem_resultado_09-09-2026.pdf"
DIA = "09/09/2026"

MODS = [
    {
        "key": "corrida",
        "label": "Corrida",
        "tempo": "tempoCorrida",
        "nota": "notaCorrida",
        "sit": None,
        "data": "dataTafCorrida",
        "rub": "rubricaCorridaSvg",
        "prova": "corrida",
    },
    {
        "key": "caminhada",
        "label": "Caminhada",
        "tempo": "tempoCaminhada",
        "nota": "notaCaminhada",
        "sit": None,
        "data": "dataTafCaminhada",
        "rub": "rubricaCaminhadaSvg",
        "prova": "caminhada",
    },
    {
        "key": "natacao",
        "label": "Natacao",
        "tempo": "tempoNatacao",
        "nota": "notaNatacao",
        "sit": None,
        "data": "dataTafNatacao",
        "rub": "rubricaNatacaoSvg",
        "prova": "natacao",
    },
    {
        "key": "permanencia",
        "label": "Permanencia",
        "tempo": "tempoPermanencia",
        "nota": None,
        "sit": "resultadoPermanencia",
        "data": "dataTafPermanencia",
        "rub": "rubricaPermanenciaSvg",
        "prova": "permanencia",
    },
]


def load_sections(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    sections: dict[str, str] = {}
    cur: str | None = None
    buf: list[str] = []
    for line in text.splitlines():
        if line.startswith("# SECTION_"):
            if cur is not None:
                sections[cur] = "\n".join(buf)
            cur = line.replace("# SECTION_", "").strip()
            buf = []
        elif not line.startswith("#") and cur:
            buf.append(line)
    if cur is not None:
        sections[cur] = "\n".join(buf)
    return sections


def parse(sec: str) -> list[dict[str, str]]:
    if not sec or not sec.strip():
        return []
    return list(csv.DictReader(StringIO(sec)))


def nip8(v: str | None) -> str:
    d = re.sub(r"\D", "", v or "")
    return d[:8] if len(d) >= 8 else d


def has_text(v: str | None) -> bool:
    t = (v or "").strip()
    return bool(t) and t not in {"—", "-", ""}


def tem_indices(c: dict[str, str], m: dict) -> bool:
    if m["nota"] and has_text(c.get(m["nota"])):
        return True
    if m["sit"]:
        sit = (c.get(m["sit"]) or "").strip().lower()
        if sit in {"aprovado", "reprovado"}:
            return True
    if m["tempo"] and has_text(c.get(m["tempo"])) and m["key"] != "permanencia":
        return True
    return False


def resumo(c: dict[str, str], m: dict) -> str:
    partes: list[str] = []
    if m["tempo"] and has_text(c.get(m["tempo"])):
        partes.append(f"tempo={c.get(m['tempo'])}")
    if m["nota"] and has_text(c.get(m["nota"])):
        partes.append(f"nota={c.get(m['nota'])}")
    if m["sit"] and has_text(c.get(m["sit"])):
        partes.append(f"sit={c.get(m['sit'])}")
    if m["data"] and has_text(c.get(m["data"])):
        partes.append(f"data={c.get(m['data'])}")
    return "; ".join(partes)


def safe(txt: str) -> str:
    repl = str.maketrans(
        {
            "á": "a",
            "à": "a",
            "â": "a",
            "ã": "a",
            "é": "e",
            "ê": "e",
            "í": "i",
            "ó": "o",
            "ô": "o",
            "õ": "o",
            "ú": "u",
            "ç": "c",
            "Á": "A",
            "À": "A",
            "Â": "A",
            "Ã": "A",
            "É": "E",
            "Ê": "E",
            "Í": "I",
            "Ó": "O",
            "Ô": "O",
            "Õ": "O",
            "Ú": "U",
            "Ç": "C",
            "—": "-",
            "–": "-",
        }
    )
    return (txt or "").translate(repl).encode("latin-1", "replace").decode("latin-1")


def main() -> None:
    backups = sorted(
        DOWNLOADS.glob("Backup apptaf*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not backups:
        raise SystemExit("Nenhum backup em Downloads")
    latest = backups[0]
    older = backups[1:]

    sec = load_sections(latest)
    cad = parse(sec.get("CADASTROS", ""))
    sess = parse(sec.get("SESSOES", ""))

    sess_idx: dict[tuple[str, str], dict[str, str]] = {}
    sess_on_day: set[tuple[str, str]] = set()
    for r in sess:
        tipo = (r.get("sessao_tipoProva") or r.get("prova") or "").strip()
        data = (r.get("sessao_dataAplicacao") or "").strip()
        n = nip8(r.get("nip"))
        if not tipo or not n:
            continue
        if data == DIA:
            sess_on_day.add((n, tipo))
        nota = (r.get("notaTexto") or r.get("noraTexto") or "").strip()
        desp = (r.get("desempenhoTexto") or "").strip()
        try:
            tms = float(r.get("tempoMs") or 0)
        except ValueError:
            tms = 0.0
        sit = (r.get("reprovacaoTexto") or "").strip()
        tem = (nota and nota != "—") or tms > 0 or (desp and desp != "—") or bool(sit)
        if not tem:
            continue
        key = (n, tipo)
        score = (2 if nota else 0) + (1 if tms > 0 or desp else 0)
        prev = sess_idx.get(key)
        prev_score = -1
        if prev:
            prev_score = (2 if prev.get("nota") else 0) + (1 if prev.get("tempo") else 0)
        if score >= prev_score:
            sess_idx[key] = {
                "nota": nota,
                "tempo": desp or "",
                "data": data,
            }

    older_maps: list[tuple[str, dict[str, dict[str, str]]]] = []
    for op in older:
        try:
            oc = parse(load_sections(op).get("CADASTROS", ""))
            older_maps.append(
                (op.name, {nip8(c.get("nip")): c for c in oc if nip8(c.get("nip"))})
            )
        except Exception:
            continue

    rows: list[dict[str, str]] = []
    for c in cad:
        n = nip8(c.get("nip"))
        nome = (c.get("nome") or "").strip()
        for m in MODS:
            if not has_text(c.get(m["rub"])):
                continue

            data_cad = (c.get(m["data"]) or "").strip()
            on_day = data_cad == DIA or (n, m["prova"]) in sess_on_day

            found_old = None
            old_name = None
            for oname, omap in older_maps:
                oc = omap.get(n)
                if not oc:
                    continue
                data_old = (oc.get(m["data"]) or "").strip()
                if data_old == DIA:
                    on_day = True
                    if tem_indices(oc, m):
                        found_old = oc
                        old_name = oname
                        break

            if not on_day:
                continue
            if tem_indices(c, m):
                continue

            found_sess = sess_idx.get((n, m["prova"]))
            if found_sess:
                status = "com resultado"
                detalhe = (
                    f"sessao {found_sess.get('data') or '-'} "
                    f"nota={found_sess.get('nota') or '-'} "
                    f"tempo={found_sess.get('tempo') or '-'}"
                )
            elif found_old:
                status = "com resultado"
                detalhe = f"backup {old_name}: {resumo(found_old, m)}"
            else:
                status = "sem resultado"
                detalhe = "nao encontrado em sessao nem backup anterior"

            data_exib = data_cad or (
                (found_old.get(m["data"]) or "").strip() if found_old else ""
            ) or DIA

            rows.append(
                {
                    "nip": (c.get("nip") or "-").strip(),
                    "nome": nome or "-",
                    "modalidade": m["label"],
                    "data": data_exib,
                    "status": status,
                    "detalhe": detalhe,
                }
            )

    rows.sort(key=lambda r: (r["modalidade"], r["nome"].lower(), r["nip"]))

    class Pdf(FPDF):
        def header(self) -> None:
            self.set_font("Helvetica", "B", 11)
            self.cell(
                0,
                8,
                safe("Rubrica sem tempo/nota/situacao — somente 09/09/2026"),
                new_x="LMARGIN",
                new_y="NEXT",
            )
            self.set_font("Helvetica", "", 8)
            self.cell(
                0,
                5,
                safe("Todas as modalidades desse dia | Status ao lado: com/sem resultado"),
                new_x="LMARGIN",
                new_y="NEXT",
            )
            self.ln(2)

        def footer(self) -> None:
            self.set_y(-12)
            self.set_font("Helvetica", "I", 8)
            self.cell(0, 8, f"Pagina {self.page_no()}/{{nb}}", align="C")

    pdf = Pdf(orientation="L", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    pdf.set_font("Helvetica", "", 8)
    com = sum(1 for r in rows if r["status"] == "com resultado")
    sem = sum(1 for r in rows if r["status"] == "sem resultado")
    pdf.cell(
        0,
        5,
        safe(
            f"Backup: {latest.name} | Total: {len(rows)} | "
            f"Com resultado: {com} | Sem resultado: {sem}"
        ),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(2)

    cols = [
        ("NIP", 28),
        ("Nome", 70),
        ("Prova", 24),
        ("Data", 24),
        ("Status", 28),
        ("Onde esta o resultado", 100),
    ]
    pdf.set_font("Helvetica", "B", 8)
    for title, w in cols:
        pdf.cell(w, 7, safe(title), border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 7)

    for r in rows:
        if r["status"] == "com resultado":
            pdf.set_fill_color(220, 252, 231)
        else:
            pdf.set_fill_color(254, 226, 226)
        vals = [
            r["nip"],
            r["nome"][:42],
            r["modalidade"],
            r["data"],
            r["status"],
            r["detalhe"][:90],
        ]
        for (_, w), val in zip(cols, vals):
            pdf.cell(w, 6, safe(val), border=1, fill=True)
        pdf.ln()

    DESKTOP.mkdir(parents=True, exist_ok=True)
    # remove PDF geral antigo se o usuario so quer este
    pdf.output(str(OUT_PDF))
    print(f"PDF: {OUT_PDF}")
    print(f"Total: {len(rows)} | com resultado: {com} | sem resultado: {sem}")
    for r in rows:
        if "WILIAN RODRIGUES" in r["nome"].upper() or r["nip"] == "05.0379.81":
            print("WILIAN:", r)


if __name__ == "__main__":
    main()
