from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Subject, MarkingScheme
from .serializers import SubjectSerializer, MarkingSchemeSerializer
from apps.users.permissions import IsExamDept


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsExamDept()]
        return [IsAuthenticated()]


class MarkingSchemeViewSet(viewsets.ModelViewSet):
    serializer_class = MarkingSchemeSerializer
    http_method_names = ['get', 'post', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        queryset = MarkingScheme.objects.select_related('subject').all()
        subject_id = self.request.query_params.get('subject_id')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)
        return queryset

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [IsExamDept()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        subject_id = request.data.get('subject_id')
        if subject_id and MarkingScheme.objects.filter(subject_id=subject_id).exists():
            return Response(
                {"error": "A marking scheme already exists for this subject."},
                status=status.HTTP_409_CONFLICT
            )
        return super().create(request, *args, **kwargs)
