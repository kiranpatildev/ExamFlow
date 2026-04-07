from django.urls import path
from .views import LoginView, RefreshView, TeacherListView, UserManagementView, UserDetailView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('teachers/', TeacherListView.as_view(), name='teacher-list'),
    path('users/', UserManagementView.as_view(), name='user-management'),
    path('users/<uuid:pk>/', UserDetailView.as_view(), name='user-detail'),
]
