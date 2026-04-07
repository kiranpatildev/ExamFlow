from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def _header_style():
    return {
        'font': Font(name='Calibri', bold=True, color='FFFFFF', size=11),
        'fill': PatternFill(start_color='1F3864', end_color='1F3864', fill_type='solid'),
        'alignment': Alignment(horizontal='center', vertical='center', wrap_text=True),
        'border': Border(
            left=Side(style='thin'), right=Side(style='thin'),
            top=Side(style='thin'), bottom=Side(style='thin'),
        ),
    }


def _apply(cell, styles):
    for k, v in styles.items():
        setattr(cell, k, v)


def generate_excel_report(results: list) -> BytesIO:
    """Consolidated report — one row per evaluated answer sheet."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Evaluation Report"

    h = _header_style()
    thin = h['border']
    center = Alignment(horizontal='center', vertical='center')

    # Title
    ws.merge_cells('A1:G1')
    _apply(ws['A1'], {
        'value': 'ExamFlow — Consolidated Evaluation Report',
        'font': Font(name='Calibri', bold=True, size=14, color='1F3864'),
        'alignment': Alignment(horizontal='center', vertical='center'),
    })
    ws.row_dimensions[1].height = 30

    headers = ['Roll Number', 'Subject Name', 'Subject Code', 'Department',
               'Semester', 'Total Marks', 'Evaluated At']
    for ci, hdr in enumerate(headers, 1):
        cell = ws.cell(row=2, column=ci, value=hdr)
        _apply(cell, h)
    ws.row_dimensions[2].height = 22

    for ri, r in enumerate(results, 3):
        row_fill = PatternFill(
            start_color='F2F2F2' if ri % 2 == 0 else 'FFFFFF',
            end_color='F2F2F2' if ri % 2 == 0 else 'FFFFFF',
            fill_type='solid'
        )
        data = [
            r.get('roll_number', ''), r.get('subject_name', ''),
            r.get('subject_code', ''), r.get('department', ''),
            r.get('semester', ''), r.get('total_marks', ''),
            str(r.get('evaluated_at', ''))[:10],
        ]
        for ci, val in enumerate(data, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.border = thin
            cell.fill = row_fill
            cell.alignment = center if ci in (1, 3, 5, 6) else Alignment(vertical='center')

    for ci in range(1, len(headers) + 1):
        max_len = max(
            (len(str(ws.cell(row=r, column=ci).value or '')) for r in range(1, ws.max_row + 1)),
            default=10
        )
        ws.column_dimensions[get_column_letter(ci)].width = min(max_len + 4, 50)

    ws.freeze_panes = 'A3'
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def generate_student_report_excel(student_reports: list) -> BytesIO:
    """
    Student Report Card — one sheet per student (or all on one sheet grouped).
    Shows each subject's marks and a grand total row.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Student Report Cards"

    h = _header_style()
    thin = h['border']
    center = Alignment(horizontal='center', vertical='center')

    # Title
    ws.merge_cells('A1:F1')
    _apply(ws['A1'], {
        'value': 'ExamFlow — Student Report Cards',
        'font': Font(name='Calibri', bold=True, size=14, color='1F3864'),
        'alignment': Alignment(horizontal='center', vertical='center'),
    })
    ws.row_dimensions[1].height = 30

    current_row = 2
    for student in student_reports:
        roll = student['roll_number']

        # Student header row
        ws.merge_cells(f'A{current_row}:F{current_row}')
        cell = ws.cell(row=current_row, column=1,
                       value=f'Roll Number: {roll}  —  Subjects: {student["subject_count"]}')
        cell.font = Font(name='Calibri', bold=True, size=12, color='FFFFFF')
        cell.fill = PatternFill(start_color='2E4057', end_color='2E4057', fill_type='solid')
        cell.alignment = Alignment(horizontal='left', vertical='center')
        ws.row_dimensions[current_row].height = 22
        current_row += 1

        # Column headers
        cols = ['Subject Code', 'Subject Name', 'Department', 'Semester', 'Total Marks', 'Evaluated At']
        for ci, col in enumerate(cols, 1):
            cell = ws.cell(row=current_row, column=ci, value=col)
            _apply(cell, h)
        ws.row_dimensions[current_row].height = 20
        current_row += 1

        # Subject rows
        for subj in student['subjects']:
            row_data = [
                subj['subject_code'], subj['subject_name'], subj['department'],
                subj['semester'], subj['total_marks'],
                str(subj.get('evaluated_at', ''))[:10],
            ]
            fill = PatternFill(start_color='EBF3FB', end_color='EBF3FB', fill_type='solid')
            for ci, val in enumerate(row_data, 1):
                cell = ws.cell(row=current_row, column=ci, value=val)
                cell.border = thin
                cell.fill = fill
                cell.alignment = center if ci in (1, 4, 5) else Alignment(vertical='center')
            current_row += 1

        # Grand total row
        total_cell = ws.cell(row=current_row, column=4, value='GRAND TOTAL')
        total_cell.font = Font(bold=True, color='1F3864')
        total_cell.alignment = Alignment(horizontal='right', vertical='center')
        total_cell.border = thin

        gt_cell = ws.cell(row=current_row, column=5, value=student['grand_total'])
        gt_cell.font = Font(bold=True, size=12, color='1F3864')
        gt_cell.fill = PatternFill(start_color='D6E4F0', end_color='D6E4F0', fill_type='solid')
        gt_cell.alignment = center
        gt_cell.border = thin

        current_row += 2  # blank row between students

    # Auto column widths
    for ci in range(1, 7):
        max_len = max(
            (len(str(ws.cell(row=r, column=ci).value or '')) for r in range(1, current_row)),
            default=10
        )
        ws.column_dimensions[get_column_letter(ci)].width = min(max_len + 4, 50)

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output
