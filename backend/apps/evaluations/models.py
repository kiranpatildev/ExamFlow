from django.db import models
from django.conf import settings
from apps.answer_sheets.models import AnswerSheet


class EvaluationResult(models.Model):
    answer_sheet = models.OneToOneField(
        AnswerSheet,
        on_delete=models.CASCADE,
        related_name='evaluation'
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='evaluations'
    )
    section_results = models.JSONField()
    total_marks = models.PositiveIntegerField()
    mark_positions = models.JSONField(default=dict, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evaluation_results'

    def __str__(self):
        return f"Evaluation for {self.answer_sheet.roll_number}"

class DraftEvaluation(models.Model):
    answer_sheet = models.OneToOneField(
        AnswerSheet,
        on_delete=models.CASCADE,
        related_name='draft_evaluation'
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='draft_evaluations'
    )
    section_results = models.JSONField()
    mark_positions = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'draft_evaluations'

    def __str__(self):
        return f"Draft for {self.answer_sheet.roll_number}"
