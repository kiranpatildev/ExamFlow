import os
import shutil
from pathlib import Path
from django.conf import settings
from django.http import FileResponse, Http404
from django.db import IntegrityError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from .models import TempImage, AnswerSheet
from .serializers import (
    AnswerSheetSerializer, AnswerSheetAssignSerializer,
    FinalizeSerializer
)
from .barcode import detect_barcode
from .pdf_compiler import compile_images_to_pdf
from apps.bundles.models import Bundle
from apps.users.models import User
from apps.users.permissions import IsScanningStaff, IsExamDept, IsTeacherOrExamDept


ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


class ImageUploadView(APIView):
    """
    POST /api/answer-sheets/upload-image/
    DELETE /api/answer-sheets/upload-image/{image_id}/
    """
    permission_classes = [IsScanningStaff]

    def post(self, request):
        bundle_id = request.data.get('bundle_id')
        image = request.FILES.get('image')
        is_first_page = request.data.get('is_first_page', 'false').lower() in ('true', '1', 'yes')
        roll_number = request.data.get('roll_number', '').strip()

        # Validate bundle
        try:
            bundle = Bundle.objects.get(pk=bundle_id, created_by=request.user)
        except Bundle.DoesNotExist:
            return Response({"error": "Bundle not found or not owned by you."}, status=status.HTTP_404_NOT_FOUND)

        if bundle.status == 'submitted':
            return Response({"error": "Cannot upload to a submitted bundle."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate image
        if not image:
            return Response({"error": "No image file provided."}, status=status.HTTP_400_BAD_REQUEST)

        if image.size > MAX_IMAGE_SIZE:
            return Response(
                {"error": "Image exceeds 10 MB limit."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            )

        if image.content_type not in ALLOWED_IMAGE_TYPES:
            return Response(
                {"error": "Only JPEG and PNG images are accepted."},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            )

        if is_first_page:
            # Detect barcode — do not save image if no barcode found
            image.seek(0)
            detected_roll = detect_barcode(image)
            if not detected_roll:
                return Response(
                    {"error": "Barcode not detected on first page. Please re-upload a clear image."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            roll_number = detected_roll

            # Check for duplicate roll number in this bundle
            if AnswerSheet.objects.filter(bundle=bundle, roll_number=roll_number).exists():
                return Response(
                    {"error": f"Roll number {roll_number} already exists in this bundle."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if TempImage.objects.filter(bundle=bundle, roll_number=roll_number).exists():
                return Response(
                    {"error": f"Roll number {roll_number} already exists in this bundle session."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            if not roll_number:
                return Response(
                    {"error": "roll_number is required for non-first pages."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Save image to tmp location
        image.seek(0)
        existing_count = TempImage.objects.filter(bundle=bundle, roll_number=roll_number).count()
        temp_img = TempImage.objects.create(
            bundle=bundle,
            roll_number=roll_number,
            image_file=image,
            uploaded_by=request.user,
            order=existing_count
        )

        response_data = {"image_id": temp_img.id}
        if is_first_page:
            response_data["roll_number"] = roll_number

        return Response(response_data, status=status.HTTP_201_CREATED)

    def delete(self, request, image_id):
        try:
            temp_img = TempImage.objects.get(pk=image_id, uploaded_by=request.user)
        except TempImage.DoesNotExist:
            return Response({"error": "Image not found."}, status=status.HTTP_404_NOT_FOUND)

        # Delete physical file
        if temp_img.image_file and os.path.exists(temp_img.image_file.path):
            os.remove(temp_img.image_file.path)
        temp_img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FinalizeAnswerSheetView(APIView):
    """POST /api/answer-sheets/finalize/"""
    permission_classes = [IsScanningStaff]

    def post(self, request):
        serializer = FinalizeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        bundle_id = serializer.validated_data['bundle_id']
        roll_number = serializer.validated_data['roll_number']
        image_ids = serializer.validated_data['image_ids']

        try:
            bundle = Bundle.objects.get(pk=bundle_id, created_by=request.user)
        except Bundle.DoesNotExist:
            return Response({"error": "Bundle not found."}, status=status.HTTP_404_NOT_FOUND)

        # Validate images belong to this bundle+roll_number
        temp_images = TempImage.objects.filter(
            id__in=image_ids,
            bundle=bundle,
            roll_number=roll_number
        ).order_by('order', 'uploaded_at')

        if temp_images.count() != len(image_ids):
            return Response(
                {"error": "Some images do not belong to this bundle and roll number."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Compile to PDF
        image_paths = [Path(img.image_file.path) for img in temp_images]
        output_pdf_path = (
            Path(settings.MEDIA_ROOT) /
            "answer_sheets" /
            str(bundle_id) /
            f"{roll_number}.pdf"
        )

        try:
            compile_images_to_pdf(image_paths, output_pdf_path)
        except Exception as e:
            return Response(
                {"error": "PDF compilation failed. Please retry."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Create AnswerSheet record
        relative_pdf = f"answer_sheets/{bundle_id}/{roll_number}.pdf"
        try:
            answer_sheet = AnswerSheet.objects.create(
                bundle=bundle,
                roll_number=roll_number,
                pdf_file=relative_pdf,
                status='pending'
            )
        except IntegrityError:
            # Roll number already finalized
            output_pdf_path.unlink(missing_ok=True)
            return Response(
                {"error": f"Roll number {roll_number} already finalized in this bundle."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete temp images
        for img in temp_images:
            if os.path.exists(img.image_file.path):
                os.remove(img.image_file.path)
        temp_images.delete()

        pdf_url = f"/media/answer_sheets/{bundle_id}/{roll_number}.pdf"
        return Response(
            {"answer_sheet_id": answer_sheet.id, "pdf_url": pdf_url},
            status=status.HTTP_201_CREATED
        )


class AnswerSheetListView(APIView):
    """GET /api/answer-sheets/"""

    def get_permissions(self):
        return [IsTeacherOrExamDept()]

    def get(self, request):
        user = request.user
        sheets = AnswerSheet.objects.select_related(
            'bundle', 'bundle__subject', 'assigned_teacher'
        ).all()

        if user.role == 'teacher':
            sheets = sheets.filter(assigned_teacher=user)

        # Filters
        bundle_id = request.query_params.get('bundle_id')
        subject_id = request.query_params.get('subject_id')
        status_filter = request.query_params.get('status')
        teacher_id = request.query_params.get('teacher_id')

        if bundle_id:
            sheets = sheets.filter(bundle_id=bundle_id)
        if subject_id:
            sheets = sheets.filter(bundle__subject_id=subject_id)
        if status_filter:
            sheets = sheets.filter(status=status_filter)
        if teacher_id and user.role == 'exam_dept':
            sheets = sheets.filter(assigned_teacher_id=teacher_id)

        paginator = PageNumberPagination()
        paginator.page_size = int(request.query_params.get('page_size', 20))
        page = paginator.paginate_queryset(sheets, request)
        serializer = AnswerSheetSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AnswerSheetAssignView(APIView):
    """PATCH /api/answer-sheets/{id}/assign/"""
    permission_classes = [IsExamDept]

    def patch(self, request, pk):
        try:
            sheet = AnswerSheet.objects.get(pk=pk)
        except AnswerSheet.DoesNotExist:
            return Response({"error": "Answer sheet not found."}, status=status.HTTP_404_NOT_FOUND)

        if sheet.status in ('under_evaluation', 'completed'):
            return Response(
                {"error": f"Cannot reassign sheet with status '{sheet.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AnswerSheetAssignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        teacher_id = serializer.validated_data['teacher_id']
        try:
            teacher = User.objects.get(id=teacher_id, role='teacher')
        except User.DoesNotExist:
            return Response({"error": "Teacher not found."}, status=status.HTTP_404_NOT_FOUND)

        sheet.assigned_teacher = teacher
        sheet.status = 'assigned'
        sheet.save()

        return Response({
            "status": "assigned",
            "assigned_teacher": {
                "id": str(teacher.id),
                "full_name": teacher.full_name,
                "email": teacher.email,
            }
        }, status=status.HTTP_200_OK)


class AnswerSheetPDFView(APIView):
    """GET /api/answer-sheets/{id}/pdf/"""

    def get_permissions(self):
        return [IsTeacherOrExamDept()]

    def get(self, request, pk):
        try:
            sheet = AnswerSheet.objects.get(pk=pk)
        except AnswerSheet.DoesNotExist:
            return Response({"error": "Answer sheet not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == 'teacher' and sheet.assigned_teacher != user:
            return Response(
                {"error": "You are not assigned to this answer sheet."},
                status=status.HTTP_403_FORBIDDEN
            )

        if not sheet.pdf_file or not os.path.exists(sheet.pdf_file.path):
            return Response({"error": "PDF file not found."}, status=status.HTTP_404_NOT_FOUND)

        # Update status to under_evaluation when a teacher opens PDF
        if user.role == 'teacher' and sheet.status == 'assigned':
            sheet.status = 'under_evaluation'
            sheet.save()

        response = FileResponse(
            open(sheet.pdf_file.path, 'rb'),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'inline; filename="{sheet.roll_number}.pdf"'
        return response
