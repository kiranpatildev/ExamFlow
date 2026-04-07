from rest_framework import serializers
from .models import EvaluationResult
from apps.answer_sheets.models import AnswerSheet


class EvaluationCreateSerializer(serializers.Serializer):
    answer_sheet_id = serializers.IntegerField()
    section_results = serializers.JSONField()

    def validate(self, data):
        answer_sheet_id = data['answer_sheet_id']
        section_results = data['section_results']

        try:
            sheet = AnswerSheet.objects.select_related(
                'bundle__subject__marking_scheme'
            ).get(pk=answer_sheet_id)
        except AnswerSheet.DoesNotExist:
            raise serializers.ValidationError({"answer_sheet_id": "Answer sheet not found."})

        data['_sheet'] = sheet

        # Validate section_results schema and marks ranges
        if not isinstance(section_results, list):
            raise serializers.ValidationError({"section_results": "Must be a list."})

        errors = []
        total_marks = 0

        for section_idx, section in enumerate(section_results):
            if 'section_name' not in section:
                errors.append(f"Section {section_idx}: missing 'section_name'.")
                continue
            if 'questions' not in section or not isinstance(section['questions'], list):
                errors.append(f"Section {section_idx}: missing 'questions' list.")
                continue

            section_total = 0
            for q_idx, q in enumerate(section['questions']):
                if 'question_no' not in q:
                    errors.append(f"Section {section_idx}, Q{q_idx}: missing 'question_no'.")
                    continue
                if 'max_marks' not in q:
                    errors.append(f"Section {section_idx}, Q{q_idx}: missing 'max_marks'.")
                    continue
                if 'marks_obtained' not in q:
                    errors.append(f"Section {section_idx}, Q{q_idx} ({q.get('question_no')}): missing 'marks_obtained'.")
                    continue

                marks = q['marks_obtained']
                max_m = q['max_marks']

                if not isinstance(marks, (int, float)) or marks < 0 or marks > max_m:
                    errors.append(
                        f"Section {section_idx}, Q{q_idx} ({q.get('question_no')}): "
                        f"marks_obtained ({marks}) must be between 0 and {max_m}."
                    )
                    continue

                section_total += marks

            total_marks += section_total
            # Add section_total to section data
            section['section_total'] = section_total

        if errors:
            raise serializers.ValidationError({"section_results": errors})

        data['_total_marks'] = int(total_marks)
        return data


class EvaluationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationResult
        fields = ['id', 'answer_sheet', 'teacher', 'section_results', 'total_marks', 'submitted_at']
        read_only_fields = ['id', 'submitted_at']
