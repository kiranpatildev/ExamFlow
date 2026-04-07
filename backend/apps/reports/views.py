from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from collections import defaultdict

from apps.evaluations.models import EvaluationResult
from apps.users.permissions import IsExamDept
from .excel_export import generate_excel_report, generate_student_report_excel
from .pdf_export import generate_pdf_report, generate_student_report_pdf


def get_filtered_results(query_params):
    """Apply filters and return queryset."""
    qs = EvaluationResult.objects.select_related(
        'answer_sheet__bundle__subject',
        'teacher'
    ).all()

    subject_id = query_params.get('subject_id')
    date_from = query_params.get('date_from')
    date_to = query_params.get('date_to')
    roll_number = query_params.get('roll_number')

    if subject_id:
        qs = qs.filter(answer_sheet__bundle__subject_id=subject_id)
    if date_from:
        qs = qs.filter(submitted_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(submitted_at__date__lte=date_to)
    if roll_number:
        qs = qs.filter(answer_sheet__roll_number__icontains=roll_number)

    return qs


def serialize_result(ev):
    sheet = ev.answer_sheet
    subject = sheet.bundle.subject
    return {
        'roll_number': sheet.roll_number,
        'subject_name': subject.subject_name,
        'subject_code': subject.subject_code,
        'department': subject.department,
        'semester': subject.semester,
        'sections': ev.section_results,
        'total_marks': ev.total_marks,
        'evaluated_at': ev.submitted_at.isoformat() if ev.submitted_at else None,
    }


def group_by_student(results):
    """
    Group results by roll_number so each student has all their subjects together.
    Returns a list of student report dicts.
    """
    students = defaultdict(list)
    for r in results:
        students[r['roll_number']].append(r)

    student_reports = []
    for roll_number, subject_results in students.items():
        grand_total = sum(r['total_marks'] for r in subject_results)
        student_reports.append({
            'roll_number': roll_number,
            'subjects': subject_results,
            'grand_total': grand_total,
            'subject_count': len(subject_results),
        })

    # Sort by roll number
    student_reports.sort(key=lambda x: x['roll_number'])
    return student_reports


class ReportView(APIView):
    """GET /api/reports/"""
    permission_classes = [IsExamDept]

    def get(self, request):
        qs = get_filtered_results(request.query_params)
        results = [serialize_result(ev) for ev in qs]

        # If a specific roll number is requested → return grouped student view
        if request.query_params.get('roll_number') and len(request.query_params.get('roll_number', '')) > 0:
            student_reports = group_by_student(results)
            return Response({
                "results": results,
                "student_reports": student_reports,
            }, status=status.HTTP_200_OK)

        return Response({"results": results}, status=status.HTTP_200_OK)


class ExcelExportView(APIView):
    """GET /api/reports/export/excel/"""
    permission_classes = [IsExamDept]

    def get(self, request):
        qs = get_filtered_results(request.query_params)
        results = [serialize_result(ev) for ev in qs]
        roll_number = request.query_params.get('roll_number')

        # If single student → generate student report card
        if roll_number:
            student_reports = group_by_student(results)
            excel_file = generate_student_report_excel(student_reports)
            filename = f"student_report_{roll_number}.xlsx"
        else:
            excel_file = generate_excel_report(results)
            filename = "examflow_report.xlsx"

        response = HttpResponse(
            excel_file.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class PDFExportView(APIView):
    """GET /api/reports/export/pdf/"""
    permission_classes = [IsExamDept]

    def get(self, request):
        qs = get_filtered_results(request.query_params)
        results = [serialize_result(ev) for ev in qs]
        roll_number = request.query_params.get('roll_number')

        if roll_number:
            student_reports = group_by_student(results)
            pdf_file = generate_student_report_pdf(student_reports)
            filename = f"student_report_{roll_number}.pdf"
        else:
            pdf_file = generate_pdf_report(results)
            filename = "examflow_report.pdf"

        response = HttpResponse(pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
