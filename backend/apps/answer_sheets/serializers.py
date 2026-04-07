from rest_framework import serializers
from .models import AnswerSheet, TempImage
from apps.subjects.serializers import SubjectSerializer
from apps.users.serializers import UserSerializer


class TempImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TempImage
        fields = ['id', 'roll_number', 'uploaded_at']


class AnswerSheetSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(source='bundle.subject', read_only=True)
    bundle_number = serializers.CharField(source='bundle.bundle_number', read_only=True)
    assigned_teacher_detail = serializers.SerializerMethodField()

    class Meta:
        model = AnswerSheet
        fields = [
            'id', 'bundle', 'bundle_number', 'subject', 'roll_number',
            'pdf_file', 'status', 'assigned_teacher', 'assigned_teacher_detail',
            'uploaded_at'
        ]
        read_only_fields = ['id', 'uploaded_at', 'pdf_file']

    def get_assigned_teacher_detail(self, obj):
        if obj.assigned_teacher:
            return {
                'id': str(obj.assigned_teacher.id),
                'full_name': obj.assigned_teacher.full_name,
                'email': obj.assigned_teacher.email,
            }
        return None


class AnswerSheetAssignSerializer(serializers.Serializer):
    teacher_id = serializers.UUIDField()

    def validate_teacher_id(self, value):
        from apps.users.models import User
        try:
            user = User.objects.get(id=value, role='teacher')
        except User.DoesNotExist:
            raise serializers.ValidationError("Teacher not found.")
        return value


class ImageUploadSerializer(serializers.Serializer):
    bundle_id = serializers.IntegerField()
    image = serializers.ImageField()
    is_first_page = serializers.BooleanField()
    roll_number = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data.get('is_first_page') and not data.get('roll_number'):
            # roll_number not required from client for first page — barcode will provide it
            pass
        return data


class FinalizeSerializer(serializers.Serializer):
    bundle_id = serializers.IntegerField()
    roll_number = serializers.CharField()
    image_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
