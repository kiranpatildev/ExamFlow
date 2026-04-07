from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def generate_excel_report(results: list) -> BytesIO:
    """
    Generate an Excel report from evaluation results.
    Returns a BytesIO object containing the .xlsx file.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Evaluation Report"

    # Styles
    header_font = Font(name='Calibri', bold=True, color='FFFFFF', size=11)
    header_fill = PatternFill(start_color='1F3864', end_color='1F3864', fill_type='solid')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin'),
    )
    center_align = Alignment(horizontal='center', vertical='center')

    # Report title row
    ws.merge_cells('A1:G1')
    title_cell = ws['A1']
    title_cell.value = 'ExamFlow — Evaluation Report'
    title_cell.font = Font(name='Calibri', bold=True, size=14, color='1F3864')
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 30

    # Header row
    headers = [
        'Roll Number', 'Subject Name', 'Subject Code',
        'Total Marks', 'Evaluated At', 'Sections Summary', 'Sections Total'
    ]
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=2, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    ws.row_dimensions[2].height = 22

    # Data rows
    for row_idx, result in enumerate(results, start=3):
        sections = result.get('sections', [])
        section_summary_parts = []
        for s in sections:
            s_name = s.get('section_name', '')
            s_total = s.get('section_total', 0)
            q_parts = [
                f"Q{q.get('question_no')}: {q.get('marks_obtained', 0)}/{q.get('max_marks', 0)}"
                for q in s.get('questions', [])
            ]
            section_summary_parts.append(f"{s_name} [{', '.join(q_parts)}]")

        sections_total = sum(s.get('section_total', 0) for s in sections)
        data = [
            result.get('roll_number', ''),
            result.get('subject_name', ''),
            result.get('subject_code', ''),
            result.get('total_marks', ''),
            result.get('evaluated_at', ''),
            ' | '.join(section_summary_parts),
            sections_total,
        ]

        fill_color = 'F2F2F2' if row_idx % 2 == 0 else 'FFFFFF'
        row_fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')

        for col_idx, value in enumerate(data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
            cell.fill = row_fill
            cell.alignment = center_align if col_idx in (1, 3, 4, 7) else Alignment(vertical='center', wrap_text=True)

    # Auto column width
    for col_idx in range(1, len(headers) + 1):
        col_letter = get_column_letter(col_idx)
        max_length = 0
        for row in ws.iter_rows(min_col=col_idx, max_col=col_idx):
            for cell in row:
                try:
                    cell_len = len(str(cell.value)) if cell.value else 0
                    max_length = max(max_length, cell_len)
                except Exception:
                    pass
        ws.column_dimensions[col_letter].width = min(max_length + 4, 60)

    # Freeze header rows
    ws.freeze_panes = 'A3'

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
