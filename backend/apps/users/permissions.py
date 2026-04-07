from rest_framework.permissions import BasePermission


class IsScanningStaff(BasePermission):
    """Allow access only to scanning staff users."""
    message = "Access restricted to scanning staff."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'scanning_staff'
        )


class IsTeacher(BasePermission):
    """Allow access only to teacher users."""
    message = "Access restricted to teachers."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'teacher'
        )


class IsExamDept(BasePermission):
    """Allow access only to exam department users."""
    message = "Access restricted to examination department."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'exam_dept'
        )


class IsTeacherOrExamDept(BasePermission):
    """Allow access to teachers or exam department users."""
    message = "Access restricted to teachers or examination department."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ('teacher', 'exam_dept')
        )


class IsExamDeptOrScanningStaff(BasePermission):
    """Allow access to exam dept or scanning staff."""
    message = "Access restricted to exam department or scanning staff."

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ('exam_dept', 'scanning_staff')
        )
