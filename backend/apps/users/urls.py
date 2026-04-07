from django.urls import path
from .views import LoginView, RefreshView, TeacherListView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('teachers/', TeacherListView.as_view(), name='teacher-list'),
]
