from django.db import models


class Subject(models.Model):
    subject_name = models.CharField(max_length=200)
    subject_code = models.CharField(max_length=50, unique=True)
    department = models.CharField(max_length=200)
    semester = models.PositiveSmallIntegerField()

    class Meta:
        db_table = 'subjects'
        ordering = ['subject_code']

    def __str__(self):
        return f"{self.subject_code} - {self.subject_name}"


class MarkingScheme(models.Model):
    subject = models.OneToOneField(Subject, on_delete=models.CASCADE, related_name='marking_scheme')
    total_marks = models.PositiveIntegerField()
    sections = models.JSONField()

    class Meta:
        db_table = 'marking_schemes'

    def __str__(self):
        return f"Scheme for {self.subject.subject_code}"

    def compute_total_marks(self):
        """Compute total marks from sections JSON."""
        total = 0
        for section in self.sections:
            for question in section.get('questions', []):
                total += question.get('max_marks', 0)
        return total
