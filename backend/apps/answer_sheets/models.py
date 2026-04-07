from django.db import models
from django.conf import settings
from apps.bundles.models import Bundle


class TempImage(models.Model):
    """Temporary image uploaded during a bundle session, before PDF finalization."""
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name='temp_images')
    roll_number = models.CharField(max_length=50)
    image_file = models.ImageField(upload_to='tmp/')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'temp_images'
        ordering = ['order', 'uploaded_at']

    def __str__(self):
        return f"TempImage bundle={self.bundle_id} roll={self.roll_number} order={self.order}"


class AnswerSheet(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('under_evaluation', 'Under Evaluation'),
        ('completed', 'Completed'),
    ]

    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name='answer_sheets')
    roll_number = models.CharField(max_length=50)
    pdf_file = models.FileField(upload_to='answer_sheets/')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    assigned_teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_sheets'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'answer_sheets'
        ordering = ['-uploaded_at']
        unique_together = [('bundle', 'roll_number')]

    def __str__(self):
        return f"AnswerSheet {self.roll_number} - Bundle {self.bundle_id}"
