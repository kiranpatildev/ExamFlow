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
