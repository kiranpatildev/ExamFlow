from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT


def generate_pdf_report(results: list) -> BytesIO:
    """
    Generate a PDF report from evaluation results using ReportLab.
    Returns a BytesIO object containing the PDF.
    """
    output = BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # Header style
    college_style = ParagraphStyle(
        name='CollegeHeader',
        fontName='Helvetica-Bold',
        fontSize=16,
        textColor=colors.HexColor('#1F3864'),
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    report_title_style = ParagraphStyle(
        name='ReportTitle',
        fontName='Helvetica',
        fontSize=12,
        textColor=colors.HexColor('#4472C4'),
        alignment=TA_CENTER,
        spaceAfter=16,
    )

    # College name header
    elements.append(Paragraph("ExamFlow — College Examination System", college_style))
    elements.append(Paragraph("Consolidated Evaluation Report", report_title_style))

    # Build table data
    headers = ['Roll Number', 'Subject Name', 'Subject Code', 'Total Marks', 'Evaluated At']
    table_data = [headers]

    for result in results:
        row = [
            result.get('roll_number', ''),
            result.get('subject_name', ''),
            result.get('subject_code', ''),
            str(result.get('total_marks', '')),
            str(result.get('evaluated_at', ''))[:10] if result.get('evaluated_at') else '',
        ]
        table_data.append(row)

    col_widths = [3.5 * cm, 7 * cm, 3.5 * cm, 3 * cm, 4 * cm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F3864')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#EBF3FB')]),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (3, 1), (3, -1), 'CENTER'),
        ('ALIGN', (2, 1), (2, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#BFBFBF')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 1 * cm))

    # Footer with generated date
    footer_style = ParagraphStyle(
        name='Footer',
        fontName='Helvetica',
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER,
    )
    generated_at = datetime.now().strftime("%d %B %Y, %I:%M %p")
    elements.append(Paragraph(f"Generated on: {generated_at}", footer_style))

    doc.build(elements)
    output.seek(0)
    return output
