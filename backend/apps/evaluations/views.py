from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import EvaluationResult
from .serializers import EvaluationCreateSerializer, EvaluationResultSerializer
from apps.answer_sheets.models import AnswerSheet
from apps.users.permissions import IsTeacher, IsTeacherOrExamDept


class EvaluationCreateView(APIView):
    """POST /api/evaluations/"""
    permission_classes = [IsTeacher]

    def post(self, request):
        serializer = EvaluationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        sheet = serializer.validated_data['_sheet']
        total_marks = serializer.validated_data['_total_marks']
        section_results = serializer.validated_data['section_results']

        # Check teacher is assigned to this sheet
        if sheet.assigned_teacher != request.user:
            return Response(
                {"error": "You are not assigned to this answer sheet."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check not already evaluated
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
        )

        # Update sheet status to completed
        sheet.status = 'completed'
        sheet.save()

        return Response({
            "id": evaluation.id,
            "total_marks": evaluation.total_marks,
            "submitted_at": evaluation.submitted_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class EvaluationDetailView(APIView):
    """GET /api/evaluations/{answer_sheet_id}/"""
    permission_classes = [IsTeacherOrExamDept]

    def get(self, request, answer_sheet_id):
        try:
            evaluation = EvaluationResult.objects.get(answer_sheet_id=answer_sheet_id)
        except EvaluationResult.DoesNotExist:
            return Response({"error": "Evaluation not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == 'teacher' and evaluation.teacher != user:
            return Response(
                {"error": "You do not have access to this evaluation."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = EvaluationResultSerializer(evaluation)
        return Response(serializer.data)


from apps.bundles.models import Bundle
from apps.bundles.serializers import BundleSerializer
from django.db.models import Count, Q

class TeacherBundleListView(APIView):
    """GET /api/teacher/bundles/"""
    permission_classes = [IsTeacher]

    def get(self, request):
        teacher = request.user
        # Find all bundles that have at least one answer sheet assigned to this teacher
        bundles = Bundle.objects.filter(
            answer_sheets__assigned_teacher=teacher
        ).distinct()

        data = []
        for b in bundles:
            total_count = b.answer_sheets.filter(assigned_teacher=teacher).count()
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


from .models import DraftEvaluation

class DraftEvaluationView(APIView):
    """POST /api/evaluations/draft/"""
    permission_classes = [IsTeacher]

    def post(self, request):
        sheet_id = request.data.get('answer_sheet_id')
        section_results = request.data.get('section_results')

        if not sheet_id or section_results is None:
            return Response({"error": "Missing required fields"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sheet = AnswerSheet.objects.get(pk=sheet_id)
        except AnswerSheet.DoesNotExist:
            return Response({"error": "Answer sheet not found."}, status=status.HTTP_404_NOT_FOUND)

        if sheet.assigned_teacher != request.user:
            return Response({"error": "Not assigned to this sheet."}, status=status.HTTP_403_FORBIDDEN)

        if sheet.status == 'completed':
            return Response({"error": "This answer sheet has already been evaluated and is locked."}, status=status.HTTP_403_FORBIDDEN)

        draft, _ = DraftEvaluation.objects.update_or_create(
            answer_sheet=sheet,
            teacher=request.user,
            defaults={'section_results': section_results}
        )
        # also set sheet state to under_evaluation if not completed
        if sheet.status != 'completed' and sheet.status != 'under_evaluation':
            sheet.status = 'under_evaluation'
            sheet.save()

        return Response({"status": "draft_saved"}, status=status.HTTP_200_OK)


class DraftEvaluationDetailView(APIView):
    """GET /api/evaluations/draft/{answer_sheet_id}/"""
    permission_classes = [IsTeacher]

    def get(self, request, answer_sheet_id):
        try:
            draft = DraftEvaluation.objects.get(answer_sheet_id=answer_sheet_id, teacher=request.user)
            return Response({"section_results": draft.section_results}, status=status.HTTP_200_OK)
        except DraftEvaluation.DoesNotExist:
            return Response({"section_results": None}, status=status.HTTP_200_OK)
