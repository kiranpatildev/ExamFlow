import json
from rest_framework import serializers
from .models import Bundle
from apps.subjects.models import Subject
from apps.subjects.serializers import SubjectSerializer


class BundleSerializer(serializers.ModelSerializer):
    subject = SubjectSerializer(read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = Bundle
        fields = [
            'id', 'subject', 'bundle_number', 'total_sheets',
            'qr_raw_data', 'status', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'created_at']


class BundleCreateSerializer(serializers.Serializer):
    qr_raw_data = serializers.CharField()

    def validate_qr_raw_data(self, value):
        try:
            data = json.loads(value)
        except json.JSONDecodeError:
            raise serializers.ValidationError("Invalid QR JSON data.")
        required_fields = ['subject_code', 'bundle_number', 'total_sheets']
        for field in required_fields:
            if field not in data:
                raise serializers.ValidationError(f"Missing field in QR data: {field}")
        if not isinstance(data['total_sheets'], int) or data['total_sheets'] <= 0:
            raise serializers.ValidationError("total_sheets must be a positive integer.")
        try:
            Subject.objects.get(subject_code=data['subject_code'])
        except Subject.DoesNotExist:
            raise serializers.ValidationError(
                f"Subject with code '{data['subject_code']}' not found."
            )
        return value

    def create(self, validated_data):
        qr_raw_data = validated_data['qr_raw_data']
        data = json.loads(qr_raw_data)
        subject = Subject.objects.get(subject_code=data['subject_code'])
        bundle = Bundle.objects.create(
            subject=subject,
            bundle_number=data['bundle_number'],
            total_sheets=data['total_sheets'],
            qr_raw_data=qr_raw_data,
            created_by=validated_data.get('created_by'),
        )
        return bundle
