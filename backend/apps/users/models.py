import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('scanning_staff', 'Scanning Staff'),
        ('teacher', 'Teacher'),
        ('exam_dept', 'Examination Department'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'role', 'full_name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.full_name} ({self.role})"
