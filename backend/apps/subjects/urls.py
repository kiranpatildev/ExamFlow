from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubjectViewSet, MarkingSchemeViewSet

router = DefaultRouter()
router.register('subjects', SubjectViewSet, basename='subject')
router.register('marking-schemes', MarkingSchemeViewSet, basename='marking-scheme')

urlpatterns = [
    path('', include(router.urls)),
]
