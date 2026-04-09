from django.urls import path
from .views import (
    EvaluationCreateView, EvaluationDetailView, 
    DraftEvaluationView, DraftEvaluationDetailView,
    TeacherBundleListView, TeacherSheetListView
)

urlpatterns = [
    path('evaluations/', EvaluationCreateView.as_view(), name='evaluation-create'),
    path('evaluations/submit/', EvaluationCreateView.as_view(), name='evaluation-submit'),
    path('evaluations/<int:answer_sheet_id>/', EvaluationDetailView.as_view(), name='evaluation-detail'),
    path('evaluations/draft/', DraftEvaluationView.as_view(), name='evaluation-draft'),
    path('evaluations/draft/<int:answer_sheet_id>/', DraftEvaluationDetailView.as_view(), name='evaluation-draft-detail'),
    path('teacher/bundles/', TeacherBundleListView.as_view(), name='teacher-bundle-list'),
    path('teacher/bundles/<int:bundle_id>/sheets/', TeacherSheetListView.as_view(), name='teacher-sheet-list'),
]
