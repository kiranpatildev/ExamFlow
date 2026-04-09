from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Bundle
from .serializers import BundleSerializer, BundleCreateSerializer
from apps.users.permissions import IsScanningStaff, IsExamDept


class BundleListCreateView(APIView):
    """
    GET  /api/bundles/  — exam_dept only
    POST /api/bundles/  — scanning_staff only
    """

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated()]

    def get(self, request):
        user = request.user
        bundles = Bundle.objects.select_related('subject', 'created_by').all()
        
        if user.role == 'scanning_staff':
            bundles = bundles.filter(created_by=user)
        
        status_filter = request.query_params.get('status')
        subject_id = request.query_params.get('subject_id')
        if status_filter:
            bundles = bundles.filter(status=status_filter)
        if subject_id:
            bundles = bundles.filter(subject_id=subject_id)

        from rest_framework.pagination import PageNumberPagination
        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get('page_size', 20))
        page = paginator.paginate_queryset(bundles, request)
        serializer = BundleSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = BundleCreateSerializer(data=request.data)
        if not serializer.is_valid():
            # Check if it's a subject not found error
            errors = serializer.errors
            if 'qr_raw_data' in errors:
                msg = str(errors['qr_raw_data'][0])
                if 'not found' in msg:
                    return Response({"error": msg}, status=status.HTTP_404_NOT_FOUND)
                return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        bundle = serializer.save(created_by=request.user)
        response_serializer = BundleSerializer(bundle)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class BundleDetailView(APIView):
    """GET /api/bundles/{id}/"""

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_bundle(self, pk, user):
        try:
            bundle = Bundle.objects.select_related('subject', 'created_by').get(pk=pk)
        except Bundle.DoesNotExist:
            return None, Response({"error": "Bundle not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role == 'scanning_staff' and bundle.created_by != user:
            return None, Response({"error": "You do not have access to this bundle."}, status=status.HTTP_403_FORBIDDEN)
        return bundle, None

    def get(self, request, pk):
        bundle, error = self.get_bundle(pk, request.user)
        if error:
            return error
        serializer = BundleSerializer(bundle)
        return Response(serializer.data)


class BundleSubmitView(APIView):
    """PATCH /api/bundles/{id}/submit/"""
    permission_classes = [IsScanningStaff]

    def patch(self, request, pk):
        try:
            bundle = Bundle.objects.get(pk=pk)
        except Bundle.DoesNotExist:
            return Response({"error": "Bundle not found."}, status=status.HTTP_404_NOT_FOUND)

        if bundle.created_by != request.user:
            return Response({"error": "You are not the owner of this bundle."}, status=status.HTTP_403_FORBIDDEN)

        if bundle.status == 'submitted':
            return Response({"error": "Bundle is already submitted."}, status=status.HTTP_400_BAD_REQUEST)

        # Check if there are finalized answer sheets
        if not bundle.answer_sheets.filter(status__in=['pending', 'assigned', 'under_evaluation', 'completed']).exists():
            return Response(
                {"error": "Cannot submit bundle. No finalized answer sheets found."},
                status=status.HTTP_400_BAD_REQUEST
            )

        bundle.status = 'submitted'
        bundle.save()
        return Response({"status": "submitted"}, status=status.HTTP_200_OK)


class BundleAssignView(APIView):
    """PATCH /api/bundles/{id}/assign/"""
    permission_classes = [IsExamDept]

    def patch(self, request, pk):
        try:
            bundle = Bundle.objects.get(pk=pk)
        except Bundle.DoesNotExist:
            return Response({"error": "Bundle not found."}, status=status.HTTP_404_NOT_FOUND)

        if bundle.status != 'submitted':
            return Response({"error": "Only submitted bundles can be assigned."}, status=status.HTTP_400_BAD_REQUEST)

        teacher_id = request.data.get('teacher_id')
        if not teacher_id:
            return Response({"error": "Teacher ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.users.models import User
        try:
            teacher = User.objects.get(id=teacher_id, role='teacher')
        except User.DoesNotExist:
            return Response({"error": "Teacher not found."}, status=status.HTTP_404_NOT_FOUND)

        # Update all answer sheets safely
        sheets = bundle.answer_sheets.filter(status__in=['pending', 'assigned'])
        if not sheets.exists():
            return Response({"error": "No assignable sheets in this bundle."}, status=status.HTTP_400_BAD_REQUEST)

        sheets.update(assigned_teacher=teacher, status='assigned')

        return Response({"status": "assigned", "assigned_teacher": teacher.full_name}, status=status.HTTP_200_OK)
