from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


DARK_BLUE = colors.HexColor('#1F3864')
MID_BLUE = colors.HexColor('#2E4057')
LIGHT_BLUE = colors.HexColor('#EBF3FB')
ACCENT = colors.HexColor('#4472C4')
WHITE = colors.white
GREY = colors.HexColor('#BFBFBF')


def _base_doc(output, landscape_mode=False):
    pagesize = landscape(A4) if landscape_mode else A4
    return SimpleDocTemplate(
        output, pagesize=pagesize,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
    )


def generate_pdf_report(results: list) -> BytesIO:
    """Consolidated report — all evaluated sheets in a table."""
    output = BytesIO()
    doc = _base_doc(output, landscape_mode=True)
    styles = getSampleStyleSheet()

    college_style = ParagraphStyle(
        'CollegeHeader', fontName='Helvetica-Bold', fontSize=16,
        textColor=DARK_BLUE, alignment=TA_CENTER, spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'Subtitle', fontName='Helvetica', fontSize=11,
        textColor=ACCENT, alignment=TA_CENTER, spaceAfter=16,
    )
    footer_style = ParagraphStyle(
        'Footer', fontName='Helvetica', fontSize=8,
        textColor=colors.grey, alignment=TA_CENTER,
    )

    elements = [
        Paragraph("ExamFlow — College Examination System", college_style),
        Paragraph("Consolidated Evaluation Report", subtitle_style),
    ]

    headers = ['Roll Number', 'Subject Name', 'Subject Code', 'Department', 'Sem', 'Total Marks', 'Date']
    table_data = [headers]
    for r in results:
        table_data.append([
            r.get('roll_number', ''),
            r.get('subject_name', ''),
            r.get('subject_code', ''),
            r.get('department', ''),
            str(r.get('semester', '')),
            str(r.get('total_marks', '')),
            str(r.get('evaluated_at', ''))[:10],
        ])

    col_widths = [3 * cm, 6 * cm, 3 * cm, 5 * cm, 1.5 * cm, 3 * cm, 3 * cm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_BLUE]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (4, 1), (5, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 1 * cm))
    generated_at = datetime.now().strftime("%d %B %Y, %I:%M %p")
    elements.append(Paragraph(f"Generated on: {generated_at}", footer_style))

    doc.build(elements)
    output.seek(0)
    return output


def generate_student_report_pdf(student_reports: list) -> BytesIO:
    """
    Student Report Card PDF — one card per student showing all subjects
    and a grand total. Each student gets a visual card block.
    """
    output = BytesIO()
    doc = _base_doc(output, landscape_mode=False)

    college_style = ParagraphStyle(
        'College', fontName='Helvetica-Bold', fontSize=18,
        textColor=DARK_BLUE, alignment=TA_CENTER, spaceAfter=2,
    )
    report_style = ParagraphStyle(
        'Report', fontName='Helvetica', fontSize=12,
        textColor=ACCENT, alignment=TA_CENTER, spaceAfter=20,
    )
    roll_style = ParagraphStyle(
        'RollNo', fontName='Helvetica-Bold', fontSize=14,
        textColor=WHITE, alignment=TA_LEFT, spaceAfter=0,
    )
    label_style = ParagraphStyle(
        'Label', fontName='Helvetica', fontSize=9,
        textColor=colors.grey, alignment=TA_LEFT,
    )
    footer_style = ParagraphStyle(
        'Footer', fontName='Helvetica', fontSize=8,
        textColor=colors.grey, alignment=TA_CENTER,
    )

    elements = [
        Paragraph("ExamFlow — College Examination System", college_style),
        Paragraph("Student Report Cards", report_style),
    ]

    for idx, student in enumerate(student_reports):
        roll = student['roll_number']

        # Student header card
        roll_table = Table(
            [[Paragraph(f"Roll Number: {roll}", roll_style),
              Paragraph(f"Subjects: {student['subject_count']}", roll_style)]],
            colWidths=[10 * cm, 5 * cm]
        )
        roll_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), MID_BLUE),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('ROUNDEDCORNERS', [6, 6, 0, 0]),
        ]))
        elements.append(roll_table)

        # Subject marks table
        subject_headers = ['Subject Code', 'Subject Name', 'Semester', 'Total Marks', 'Evaluated On']
        table_data = [subject_headers]

        for subj in student['subjects']:
            table_data.append([
                subj['subject_code'],
                subj['subject_name'],
                str(subj.get('semester', '')),
                str(subj['total_marks']),
                str(subj.get('evaluated_at', ''))[:10],
            ])

        # Grand total row
        table_data.append(['', '', 'GRAND TOTAL', str(student['grand_total']), ''])

        col_widths = [3 * cm, 6.5 * cm, 2.5 * cm, 3 * cm, 3 * cm]
        subj_table = Table(table_data, colWidths=col_widths)
        subj_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), ACCENT),
            ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            # Body
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [WHITE, LIGHT_BLUE]),
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -2), 9),
            ('ALIGN', (2, 1), (3, -1), 'CENTER'),
            # Grand total row
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#D6E4F0')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 10),
            ('TEXTCOLOR', (0, -1), (-1, -1), DARK_BLUE),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, GREY),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(subj_table)
        elements.append(Spacer(1, 0.6 * cm))

        # Page break between students (except last)
        if idx < len(student_reports) - 1:
            elements.append(HRFlowable(width='100%', thickness=1, color=GREY))
            elements.append(Spacer(1, 0.4 * cm))
            if len(student_reports) > 3:
                elements.append(PageBreak())

    generated_at = datetime.now().strftime("%d %B %Y, %I:%M %p")
    elements.append(Paragraph(f"Generated on: {generated_at}", footer_style))

    doc.build(elements)
    output.seek(0)
    return output
