from django.db import models
from django.conf import settings
from apps.subjects.models import Subject


class Bundle(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('submitted', 'Submitted'),
    ]

    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name='bundles')
    bundle_number = models.CharField(max_length=100)
    total_sheets = models.PositiveIntegerField()
    qr_raw_data = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_bundles'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bundles'
        ordering = ['-created_at']

    def __str__(self):
        return f"Bundle {self.bundle_number} - {self.subject.subject_code}"
