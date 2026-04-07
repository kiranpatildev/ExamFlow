from django.urls import path
from .views import ReportView, ExcelExportView, PDFExportView

urlpatterns = [
    path('reports/', ReportView.as_view(), name='reports'),
    path('reports/export/excel/', ExcelExportView.as_view(), name='report-excel'),
    path('reports/export/pdf/', PDFExportView.as_view(), name='report-pdf'),
]
