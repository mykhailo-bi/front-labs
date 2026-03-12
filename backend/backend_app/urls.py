from django.urls import include, path

from backend_app.api import (
    checkout,
    login,
    logout,
    mark_paid,
    me,
    change_password,
    password_reset_request,
    password_reset_confirm,
    email_verification_request,
    email_verification_confirm,
    register,
    report_aggregate,
    router,
    token_refresh,
)

urlpatterns = [
    path('auth/register/', register),
    path('auth/login/', login),
    path('auth/refresh/', token_refresh),
    path('auth/logout/', logout),
    path('auth/change-password/', change_password),
    path('auth/password-reset/', password_reset_request),
    path('auth/password-reset/confirm/', password_reset_confirm),
    path('auth/email-verification/', email_verification_request),
    path('auth/email-verification/confirm/', email_verification_confirm),
    path('me/', me),
    path('checkout/', checkout),
    path('payments/mark-paid/', mark_paid),
    path('reports/aggregate/', report_aggregate),
    path('', include(router.urls)),
]
