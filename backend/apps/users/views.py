from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import User
from .serializers import TeacherListSerializer
from .permissions import IsExamDept


class LoginView(TokenObtainPairView):
    """Unified login endpoint for all roles."""
    pass


class RefreshView(TokenRefreshView):
    """Token refresh endpoint."""
    pass


class TeacherListView(APIView):
    """List all teachers — used by exam dept for assignment dropdown."""
    permission_classes = [IsExamDept]

    def get(self, request):
        teachers = User.objects.filter(role='teacher').order_by('full_name')
        serializer = TeacherListSerializer(teachers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
