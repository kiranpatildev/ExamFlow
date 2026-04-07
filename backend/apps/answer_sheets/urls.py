from django.urls import path
from .views import (
    ImageUploadView, FinalizeAnswerSheetView,
    AnswerSheetListView, AnswerSheetAssignView, AnswerSheetPDFView
)

urlpatterns = [
    path('answer-sheets/upload-image/', ImageUploadView.as_view(), name='image-upload'),
    path('answer-sheets/upload-image/<int:image_id>/', ImageUploadView.as_view(), name='image-delete'),
    path('answer-sheets/finalize/', FinalizeAnswerSheetView.as_view(), name='finalize-sheet'),
    path('answer-sheets/', AnswerSheetListView.as_view(), name='answer-sheet-list'),
    path('answer-sheets/<int:pk>/assign/', AnswerSheetAssignView.as_view(), name='answer-sheet-assign'),
    path('answer-sheets/<int:pk>/pdf/', AnswerSheetPDFView.as_view(), name='answer-sheet-pdf'),
]
