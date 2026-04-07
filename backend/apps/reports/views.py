from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.evaluations.models import EvaluationResult
from apps.users.permissions import IsExamDept
from .excel_export import generate_excel_report
from .pdf_export import generate_pdf_report


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
        'sections': ev.section_results,
        'total_marks': ev.total_marks,
        'evaluated_at': ev.submitted_at.isoformat() if ev.submitted_at else None,
    }


class ReportView(APIView):
    """GET /api/reports/"""
    permission_classes = [IsExamDept]

    def get(self, request):
        qs = get_filtered_results(request.query_params)
        results = [serialize_result(ev) for ev in qs]
        return Response({"results": results}, status=status.HTTP_200_OK)


class ExcelExportView(APIView):
    """GET /api/reports/export/excel/"""
    permission_classes = [IsExamDept]

    def get(self, request):
        qs = get_filtered_results(request.query_params)
        results = [serialize_result(ev) for ev in qs]
        excel_file = generate_excel_report(results)

        response = HttpResponse(
            excel_file.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="examflow_report.xlsx"'
        return response


class PDFExportView(APIView):
    """GET /api/reports/export/pdf/"""
    permission_classes = [IsExamDept]

    def get(self, request):
        qs = get_filtered_results(request.query_params)
        results = [serialize_result(ev) for ev in qs]
        pdf_file = generate_pdf_report(results)

        response = HttpResponse(pdf_file.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="examflow_report.pdf"'
        return response
