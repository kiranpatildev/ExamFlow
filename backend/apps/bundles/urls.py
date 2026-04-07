from django.urls import path
from .views import BundleListCreateView, BundleDetailView, BundleSubmitView

urlpatterns = [
    path('bundles/', BundleListCreateView.as_view(), name='bundle-list-create'),
    path('bundles/<int:pk>/', BundleDetailView.as_view(), name='bundle-detail'),
    path('bundles/<int:pk>/submit/', BundleSubmitView.as_view(), name='bundle-submit'),
]
