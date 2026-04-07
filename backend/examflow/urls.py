"""ExamFlow URL Configuration"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/', include('apps.subjects.urls')),
    path('api/', include('apps.bundles.urls')),
    path('api/', include('apps.answer_sheets.urls')),
    path('api/', include('apps.evaluations.urls')),
    path('api/', include('apps.reports.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
