from django.urls import path
from .views import EvaluationCreateView, EvaluationDetailView

urlpatterns = [
    path('evaluations/', EvaluationCreateView.as_view(), name='evaluation-create'),
    path('evaluations/<int:answer_sheet_id>/', EvaluationDetailView.as_view(), name='evaluation-detail'),
]
