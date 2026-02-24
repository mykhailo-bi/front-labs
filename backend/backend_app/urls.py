from django.urls import include, path

from backend_app.api import (
    checkout,
    login,
    mark_paid,
    me,
    register,
    report_aggregate,
    router,
    token_refresh,
)

urlpatterns = [
    path('auth/register/', register),
    path('auth/login/', login),
    path('auth/refresh/', token_refresh),
    path('me/', me),
    path('checkout/', checkout),
    path('payments/mark-paid/', mark_paid),
    path('reports/aggregate/', report_aggregate),
    path('', include(router.urls)),
]
