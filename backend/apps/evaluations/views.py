from pathlib import Path
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import EvaluationResult, DraftEvaluation
from .serializers import EvaluationCreateSerializer, EvaluationResultSerializer
from apps.answer_sheets.models import AnswerSheet
from apps.users.permissions import IsTeacher, IsTeacherOrExamDept

log = logging.getLogger(__name__)


def _build_marked_pdf_url(request, answer_sheet):
    """Return a full URL to the marked PDF if it exists, else None."""
    if not answer_sheet.marked_pdf_file:
        return None
    base = request.build_absolute_uri('/')[:-1]
    return f"{base}/media/{answer_sheet.marked_pdf_file}"


def _annotate_and_save(answer_sheet, mark_positions, request):
    """
    Run the PDF annotator, save the result, update the AnswerSheet record.
    Returns the full URL of the marked PDF, or None on failure.
    """
    from django.conf import settings as django_settings
    from .pdf_annotator import annotate_pdf

    try:
        original_path = Path(answer_sheet.pdf_file.path)
        stem = original_path.stem
        output_path = original_path.parent / f"{stem}_marked.pdf"

        annotate_pdf(original_path, output_path, mark_positions)

        rel = output_path.relative_to(Path(django_settings.MEDIA_ROOT))
        answer_sheet.marked_pdf_file = str(rel)
        answer_sheet.save(update_fields=['marked_pdf_file'])

        return _build_marked_pdf_url(request, answer_sheet)
    except Exception:
        log.exception("PDF annotation failed for sheet %s", answer_sheet.id)
        return None


# ─── Final submit ──────────────────────────────────────────────────────────────

class EvaluationCreateView(APIView):
    """POST /api/evaluations/  and  POST /api/evaluations/submit/"""
    permission_classes = [IsTeacher]

    def post(self, request):
        serializer = EvaluationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        sheet           = serializer.validated_data['_sheet']
        total_marks     = serializer.validated_data['_total_marks']
        section_results = serializer.validated_data['section_results']
        mark_positions  = request.data.get('mark_positions', {})
        if not isinstance(mark_positions, dict):
            mark_positions = {}

        if sheet.assigned_teacher != request.user:
            return Response(
                {"error": "You are not assigned to this answer sheet."},
                status=status.HTTP_403_FORBIDDEN
            )

        if EvaluationResult.objects.filter(answer_sheet=sheet).exists():
            return Response(
                {"error": "This answer sheet has already been evaluated."},
                status=status.HTTP_409_CONFLICT
            )

        evaluation = EvaluationResult.objects.create(
            answer_sheet=sheet,
            teacher=request.user,
            section_results=section_results,
            total_marks=total_marks,
            mark_positions=mark_positions,
        )

        # Mark sheet as completed
        sheet.status = 'completed'
        sheet.save(update_fields=['status'])

        # Annotate PDF if positions were given and original PDF exists
        marked_pdf_url = None
        if mark_positions and sheet.pdf_file:
            marked_pdf_url = _annotate_and_save(sheet, mark_positions, request)

        # Clean up draft
        DraftEvaluation.objects.filter(answer_sheet=sheet).delete()

        resp = {
            "id": evaluation.id,
            "total_marks": evaluation.total_marks,
            "submitted_at": evaluation.submitted_at.isoformat(),
        }
        if marked_pdf_url:
            resp["marked_pdf_url"] = marked_pdf_url

        return Response(resp, status=status.HTTP_201_CREATED)


# ─── Detail + regenerate ───────────────────────────────────────────────────────

class EvaluationDetailView(APIView):
    """GET /api/evaluations/{answer_sheet_id}/"""
    permission_classes = [IsTeacherOrExamDept]

    def get(self, request, answer_sheet_id):
        try:
            evaluation = EvaluationResult.objects.select_related('answer_sheet').get(
                answer_sheet_id=answer_sheet_id
            )
        except EvaluationResult.DoesNotExist:
            return Response({"error": "Evaluation not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == 'teacher' and evaluation.teacher != user:
            return Response(
                {"error": "You do not have access to this evaluation."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = EvaluationResultSerializer(evaluation).data
        data['marked_pdf_url'] = _build_marked_pdf_url(request, evaluation.answer_sheet)
        return Response(data)


class GenerateMarkedPDFView(APIView):
    """
    POST /api/evaluations/{answer_sheet_id}/generate-marked-pdf/

    (Re)generates the mark-annotated PDF for an already-completed evaluation.
    Useful when the initial generation failed, or the teacher wants to regenerate
    after changing label positions.
    """
    permission_classes = [IsTeacherOrExamDept]

    def post(self, request, answer_sheet_id):
        try:
            evaluation = EvaluationResult.objects.select_related('answer_sheet').get(
                answer_sheet_id=answer_sheet_id
            )
        except EvaluationResult.DoesNotExist:
            return Response({"error": "Evaluation not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == 'teacher' and evaluation.teacher != user:
            return Response(
                {"error": "You do not have access to this evaluation."},
                status=status.HTTP_403_FORBIDDEN
            )

        sheet          = evaluation.answer_sheet
        mark_positions = evaluation.mark_positions

        if not mark_positions:
            return Response(
                {"error": "No mark positions saved for this evaluation. Cannot generate marked PDF."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not sheet.pdf_file:
            return Response(
                {"error": "Original PDF not found for this answer sheet."},
                status=status.HTTP_404_NOT_FOUND
            )

        marked_url = _annotate_and_save(sheet, mark_positions, request)
        if not marked_url:
            return Response(
                {"error": "PDF annotation failed. Check server logs."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({"marked_pdf_url": marked_url}, status=status.HTTP_200_OK)


# ─── Teacher views ─────────────────────────────────────────────────────────────

from apps.bundles.models import Bundle


class TeacherBundleListView(APIView):
    """GET /api/teacher/bundles/"""
    permission_classes = [IsTeacher]

    def get(self, request):
        teacher = request.user
        bundles = Bundle.objects.filter(
            answer_sheets__assigned_teacher=teacher
        ).distinct()

        data = []
        for b in bundles:
            total_count     = b.answer_sheets.filter(assigned_teacher=teacher).count()
            evaluated_count = b.answer_sheets.filter(assigned_teacher=teacher, status='completed').count()
            data.append({
                "id": b.id,
                "subject_name": b.subject.subject_name,
                "subject_code": b.subject.subject_code,
                "bundle_number": b.bundle_number,
                "total_sheets": total_count,
                "evaluated_count": evaluated_count,
            })
        return Response(data)


class TeacherSheetListView(APIView):
    """GET /api/teacher/bundles/{bundle_id}/sheets/"""
    permission_classes = [IsTeacher]

    def get(self, request, bundle_id):
        teacher = request.user
        sheets = AnswerSheet.objects.filter(
            bundle_id=bundle_id,
            assigned_teacher=teacher
        ).order_by('roll_number')

        from apps.answer_sheets.serializers import AnswerSheetSerializer
        serializer = AnswerSheetSerializer(sheets, many=True)
        return Response(serializer.data)


# ─── Draft views ───────────────────────────────────────────────────────────────

class DraftEvaluationView(APIView):
    """POST /api/evaluations/draft/"""
    permission_classes = [IsTeacher]

    def post(self, request):
        sheet_id        = request.data.get('answer_sheet_id')
        section_results = request.data.get('section_results')
        mark_positions  = request.data.get('mark_positions', {})
        if not isinstance(mark_positions, dict):
            mark_positions = {}

        if not sheet_id or section_results is None:
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sheet = AnswerSheet.objects.get(pk=sheet_id)
        except AnswerSheet.DoesNotExist:
            return Response({"error": "Answer sheet not found."}, status=status.HTTP_404_NOT_FOUND)

        if sheet.assigned_teacher != request.user:
            return Response({"error": "Not assigned to this sheet."}, status=status.HTTP_403_FORBIDDEN)

        if sheet.status == 'completed':
            return Response(
                {"error": "This answer sheet has already been evaluated and is locked."},
                status=status.HTTP_403_FORBIDDEN
            )

        DraftEvaluation.objects.update_or_create(
            answer_sheet=sheet,
            teacher=request.user,
            defaults={
                'section_results': section_results,
                'mark_positions': mark_positions,
            }
        )

        if sheet.status not in ('completed', 'under_evaluation'):
            sheet.status = 'under_evaluation'
            sheet.save(update_fields=['status'])

        return Response({"status": "draft_saved"}, status=status.HTTP_200_OK)


class DraftEvaluationDetailView(APIView):
    """GET /api/evaluations/draft/{answer_sheet_id}/"""
    permission_classes = [IsTeacher]

    def get(self, request, answer_sheet_id):
        try:
            draft = DraftEvaluation.objects.get(
                answer_sheet_id=answer_sheet_id,
                teacher=request.user
            )
            return Response({
                "section_results": draft.section_results,
                "mark_positions":  draft.mark_positions,
            }, status=status.HTTP_200_OK)
        except DraftEvaluation.DoesNotExist:
            return Response({"section_results": None, "mark_positions": {}}, status=status.HTTP_200_OK)
