from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .models import User
from .serializers import TeacherListSerializer, UserSerializer
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


class UserManagementView(APIView):
    """
    GET  /api/auth/users/        — list all users (exam_dept only)
    POST /api/auth/users/        — create a new user (exam_dept only)
    """
    permission_classes = [IsExamDept]

    def get(self, request):
        role_filter = request.query_params.get('role')
        users = User.objects.all().order_by('role', 'full_name')
        if role_filter:
            users = users.filter(role=role_filter)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        role = data.get('role', '').strip()
        full_name = data.get('full_name', '').strip()
        email = data.get('email', '').strip()

        errors = {}
        if not username:
            errors['username'] = 'Username is required.'
        elif User.objects.filter(username=username).exists():
            errors['username'] = 'Username already taken.'
        if not password or len(password) < 6:
            errors['password'] = 'Password must be at least 6 characters.'
        if role not in ('scanning_staff', 'teacher', 'exam_dept'):
            errors['role'] = 'Role must be scanning_staff, teacher, or exam_dept.'
        if not full_name:
            errors['full_name'] = 'Full name is required.'
        if not email:
            errors['email'] = 'Email is required.'
        elif User.objects.filter(email=email).exists():
            errors['email'] = 'Email already in use.'

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=password,
            role=role,
            full_name=full_name,
            email=email,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    PATCH /api/auth/users/{id}/  — update user (reset password, change role)
    DELETE /api/auth/users/{id}/ — delete user
    """
    permission_classes = [IsExamDept]

    def get_user(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def patch(self, request, pk):
        user = self.get_user(pk)
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if 'full_name' in data:
            user.full_name = data['full_name'].strip()
        if 'email' in data:
            email = data['email'].strip()
            if User.objects.filter(email=email).exclude(pk=pk).exists():
                return Response({'email': 'Email already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
        if 'role' in data:
            if data['role'] not in ('scanning_staff', 'teacher', 'exam_dept'):
                return Response({'role': 'Invalid role.'}, status=status.HTTP_400_BAD_REQUEST)
            user.role = data['role']
        if 'password' in data and data['password']:
            if len(data['password']) < 6:
                return Response({'password': 'Minimum 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
            user.set_password(data['password'])

        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, pk):
        user = self.get_user(pk)
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if str(user.pk) == str(request.user.pk):
            return Response({'error': 'Cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
