from rest_framework import serializers
from .models import Subject, MarkingScheme


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'subject_name', 'subject_code', 'department', 'semester']


class QuestionSerializer(serializers.Serializer):
    question_no = serializers.CharField()
    max_marks = serializers.IntegerField(min_value=0)


class SectionSerializer(serializers.Serializer):
    section_name = serializers.CharField()
    questions = QuestionSerializer(many=True)


class MarkingSchemeSerializer(serializers.ModelSerializer):
    subject_id = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), source='subject', write_only=True
    )
    subject = SubjectSerializer(read_only=True)
    sections = serializers.JSONField()

    class Meta:
        model = MarkingScheme
        fields = ['id', 'subject', 'subject_id', 'total_marks', 'sections']
        read_only_fields = ['id', 'total_marks']

    def validate_sections(self, value):
        """Validate sections schema."""
        if not isinstance(value, list) or len(value) == 0:
            raise serializers.ValidationError("sections must be a non-empty list.")
        for section in value:
            if 'section_name' not in section:
                raise serializers.ValidationError("Each section must have a 'section_name'.")
            if 'questions' not in section or not isinstance(section['questions'], list):
                raise serializers.ValidationError("Each section must have a 'questions' list.")
            for q in section['questions']:
                if 'question_no' not in q:
                    raise serializers.ValidationError("Each question must have a 'question_no'.")
                if 'max_marks' not in q or not isinstance(q['max_marks'], int) or q['max_marks'] < 0:
                    raise serializers.ValidationError("Each question must have a valid 'max_marks' >= 0.")
        return value

    def create(self, validated_data):
        sections = validated_data['sections']
        total = sum(
            q['max_marks']
            for s in sections
            for q in s.get('questions', [])
        )
        validated_data['total_marks'] = total
        return super().create(validated_data)

    def update(self, instance, validated_data):
        sections = validated_data.get('sections', instance.sections)
        total = sum(
            q['max_marks']
            for s in sections
            for q in s.get('questions', [])
        )
        validated_data['total_marks'] = total
        return super().update(instance, validated_data)
