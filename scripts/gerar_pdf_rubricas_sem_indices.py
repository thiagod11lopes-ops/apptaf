"""Lista militares com rúbrica e sem tempo/nota/situação; gera PDF na Área de Trabalho."""

from __future__ import annotations

import csv
import re
from io import StringIO
from pathlib import Path

from fpdf import FPDF

DOWNLOADS = Path.home() / "Downloads"
DESKTOP = Path.home() / "Desktop"
OUT_PDF = DESKTOP / "Rubricas_sem_tempo_nota_situacao.pdf"

MODALIDADES = [
    {
        "key": "corrida",
        "label": "Corrida",
        "tempo": "tempoCorrida",
        "nota": "notaCorrida",
        "situacao": None,
        "data": "dataTafCorrida",
        "rubrica": "rubricaCorridaSvg",
        "prova_sessao": "corrida",
    },
    {
        "key": "caminhada",
        "label": "Caminhada",
        "tempo": "tempoCaminhada",
        "nota": "notaCaminhada",
        "situacao": None,
        "data": "dataTafCaminhada",
        "rubrica": "rubricaCaminhadaSvg",
        "prova_sessao": "caminhada",
    },
    {
        "key": "natacao",
        "label": "Natação",
        "tempo": "tempoNatacao",
        "nota": "notaNatacao",
        "situacao": None,
        "data": "dataTafNatacao",
        "rubrica": "rubricaNatacaoSvg",
        "prova_sessao": "natacao",
    },
    {
        "key": "permanencia",
        "label": "Permanência",
        "tempo": "tempoPermanencia",
        "nota": None,
        "situacao": "resultadoPermanencia",
        "data": "dataTafPermanencia",
        "rubrica": "rubricaPermanenciaSvg",
        "prova_sessao": "permanencia",
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


def parse_csv(sec: str) -> list[dict[str, str]]:
    if not sec or not sec.strip():
        return []
    return list(csv.DictReader(StringIO(sec)))


def nip_digits(v: str | None) -> str:
    return re.sub(r"\D", "", v or "")


def has_text(v: str | None) -> bool:
    t = (v or "").strip()
    return bool(t) and t not in {"—", "-", "n/a", "N/A"}


def has_rubrica(v: str | None) -> bool:
    t = (v or "").strip()
    if not t or t in {"—", "-"}:
        return False
    return True


def tem_indices_cadastro(c: dict[str, str], mod: dict) -> bool:
    tempo_ok = has_text(c.get(mod["tempo"])) if mod["tempo"] else False
    nota_ok = has_text(c.get(mod["nota"])) if mod["nota"] else False
    sit_ok = False
    if mod["situacao"]:
        sit = (c.get(mod["situacao"]) or "").strip().lower()
        sit_ok = sit in {"aprovado", "reprovado"}
    # Nota numérica / REPROVADO / Aprovado conta como índice
    if nota_ok:
        return True
    if sit_ok:
        return True
    if tempo_ok and mod["key"] != "permanencia":
        # tempo sozinho já é desempenho; permanência usa situação
        return True
    if tempo_ok and mod["key"] == "permanencia" and sit_ok:
        return True
    return False


def resumo_indices_cadastro(c: dict[str, str], mod: dict) -> str:
    partes: list[str] = []
    if mod["tempo"] and has_text(c.get(mod["tempo"])):
        partes.append(f"tempo={c.get(mod['tempo'])}")
    if mod["nota"] and has_text(c.get(mod["nota"])):
        partes.append(f"nota={c.get(mod['nota'])}")
    if mod["situacao"] and has_text(c.get(mod["situacao"])):
        partes.append(f"sit={c.get(mod['situacao'])}")
    if mod["data"] and has_text(c.get(mod["data"])):
        partes.append(f"data={c.get(mod['data'])}")
    return "; ".join(partes) if partes else ""


def build_sessao_index(sessoes: list[dict[str, str]]) -> dict[tuple[str, str], dict[str, str]]:
    """(nip8|nome, tipoProva) -> melhor resultado da sessão."""
    out: dict[tuple[str, str], dict[str, str]] = {}
    for r in sessoes:
        tipo = (r.get("sessao_tipoProva") or r.get("prova") or "").strip()
        if not tipo:
            continue
        nip = nip_digits(r.get("nip"))
        nome = (r.get("nome") or "").strip().lower()
        key_id = nip[:8] if len(nip) >= 8 else (f"nome:{nome}" if nome else "")
        if not key_id:
            continue
        key = (key_id, tipo)
        nota = (r.get("notaTexto") or r.get("noraTexto") or "").strip()
        desp = (r.get("desempenhoTexto") or "").strip()
        try:
            tms = float(r.get("tempoMs") or 0)
        except ValueError:
            tms = 0.0
        sit = (r.get("reprovacaoTexto") or "").strip()
        tem = bool(nota and nota != "—") or tms > 0 or bool(desp and desp != "—") or bool(sit)
        if not tem:
            continue
        prev = out.get(key)
        score = (2 if nota else 0) + (1 if tms > 0 or desp else 0)
        prev_score = 0
        if prev:
            prev_score = (2 if prev.get("nota") else 0) + (1 if prev.get("tempo") else 0)
        if not prev or score >= prev_score:
            out[key] = {
                "nota": nota,
                "tempo": desp or (str(int(tms)) if tms > 0 else ""),
                "data": (r.get("sessao_dataAplicacao") or "").strip(),
                "fonte": "sessao",
            }
    return out


def find_latest_backup() -> Path:
    files = sorted(
        DOWNLOADS.glob("Backup apptaf*.csv"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not files:
        raise FileNotFoundError("Nenhum Backup apptaf*.csv em Downloads")
    return files[0]


def collect_rows() -> tuple[list[dict[str, str]], Path, list[Path]]:
    latest = find_latest_backup()
    older = sorted(
        [p for p in DOWNLOADS.glob("Backup apptaf*.csv") if p != latest],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )

    sec = load_sections(latest)
    cadastros = parse_csv(sec.get("CADASTROS", ""))
    sessoes = parse_csv(sec.get("SESSOES", ""))
    sess_idx = build_sessao_index(sessoes)

    older_cads: list[dict[str, dict[str, str]]] = []
    for op in older:
        try:
            oc = parse_csv(load_sections(op).get("CADASTROS", ""))
            older_cads.append({nip_digits(c.get("nip"))[:8]: c for c in oc if len(nip_digits(c.get("nip"))) >= 8})
        except Exception:
            continue

    rows: list[dict[str, str]] = []
    for c in cadastros:
        nip = (c.get("nip") or "").strip()
        nome = (c.get("nome") or "").strip()
        nip8 = nip_digits(nip)[:8]
        for mod in MODALIDADES:
            if not has_rubrica(c.get(mod["rubrica"])):
                continue
            if tem_indices_cadastro(c, mod):
                continue

            # Existe resultado em sessão?
            sess_key = (nip8 if len(nip8) >= 8 else f"nome:{(nome or '').lower()}", mod["prova_sessao"])
            found_sess = sess_idx.get(sess_key)
            found_old = None
            if len(nip8) >= 8:
                for ocmap in older_cads:
                    oc = ocmap.get(nip8)
                    if oc and tem_indices_cadastro(oc, mod):
                        found_old = oc
                        break

            if found_sess:
                status = "com resultado"
                detalhe = (
                    f"sessão {found_sess.get('data') or '—'} · "
                    f"nota={found_sess.get('nota') or '—'} · tempo={found_sess.get('tempo') or '—'}"
                )
            elif found_old:
                status = "com resultado"
                detalhe = f"backup anterior · {resumo_indices_cadastro(found_old, mod)}"
            else:
                status = "sem resultado"
                detalhe = "não encontrado em sessão nem backup anterior"

            rows.append(
                {
                    "nip": nip or "—",
                    "nome": nome or "—",
                    "modalidade": mod["label"],
                    "data_cadastro": (c.get(mod["data"]) or "").strip() or "—",
                    "status": status,
                    "detalhe": detalhe,
                }
            )

    rows.sort(key=lambda r: (r["modalidade"], r["nome"].lower(), r["nip"]))
    return rows, latest, older


class Pdf(FPDF):
    def header(self) -> None:
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 8, "Militares com rubrica e sem tempo/nota/situacao", ln=1)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, "Fonte: backup local AppTAF | Status = resultado em sessao ou backup anterior", ln=1)
        self.ln(2)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 8, f"Pagina {self.page_no()}/{{nb}}", align="C")


def safe(txt: str) -> str:
    # fpdf core fonts: evita caracteres não latin-1
    return (
        (txt or "")
        .replace("—", "-")
        .replace("–", "-")
        .replace("ção", "cao")
        .replace("ã", "a")
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
        .replace("Ç", "C")
        .replace("Á", "A")
        .replace("Ã", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ô", "O")
        .replace("Ú", "U")
        .encode("latin-1", "replace")
        .decode("latin-1")
    )


def write_pdf(rows: list[dict[str, str]], latest: Path) -> Path:
    pdf = Pdf(orientation="L", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, safe(f"Backup: {latest.name} | Total: {len(rows)} ocorrencias"), ln=1)
    com = sum(1 for r in rows if r["status"] == "com resultado")
    sem = sum(1 for r in rows if r["status"] == "sem resultado")
    pdf.cell(0, 5, safe(f"Com resultado: {com} | Sem resultado: {sem}"), ln=1)
    pdf.ln(2)

    # Cabeçalho
    cols = [
        ("NIP", 28),
        ("Nome", 70),
        ("Prova", 24),
        ("Data cad.", 24),
        ("Status", 28),
        ("Onde esta o resultado", 100),
    ]
    pdf.set_font("Helvetica", "B", 8)
    for title, w in cols:
        pdf.cell(w, 7, safe(title), border=1)
    pdf.ln()
    pdf.set_font("Helvetica", "", 7)

    for r in rows:
        line_h = 6
        vals = [
            safe(r["nip"]),
            safe(r["nome"][:42]),
            safe(r["modalidade"]),
            safe(r["data_cadastro"]),
            safe(r["status"]),
            safe(r["detalhe"][:90]),
        ]
        # cor suave por status
        if r["status"] == "com resultado":
            pdf.set_fill_color(220, 252, 231)
        else:
            pdf.set_fill_color(254, 226, 226)
        for (title, w), val in zip(cols, vals):
            pdf.cell(w, line_h, val, border=1, fill=True)
        pdf.ln()

    DESKTOP.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT_PDF))
    return OUT_PDF


def main() -> None:
    rows, latest, _older = collect_rows()
    path = write_pdf(rows, latest)
    com = sum(1 for r in rows if r["status"] == "com resultado")
    sem = sum(1 for r in rows if r["status"] == "sem resultado")
    print(f"PDF: {path}")
    print(f"Total: {len(rows)} | com resultado: {com} | sem resultado: {sem}")
    print(f"Backup: {latest.name}")


if __name__ == "__main__":
    main()
