from django.urls import path
from . import views

app_name = 'lab5_app2'

urlpatterns = [
    path('courses/', views.course_list, name='course_list'),
    path('courses/add/', views.course_create, name='course_create'),
    path('courses/<int:id>/', views.course_detail, name='course_detail'),
    path('courses/<int:id>/edit', views.course_edit, name='course_edit'),
    path('courses/<int:id>/delete/', views.course_delete, name='course_delete'),

    path('students/', views.student_list, name='student_list'),
    path('students/add/', views.student_create, name='student_create'),
    path('students/<int:id>/', views.student_detail, name='student_detail'),
    path('students/<int:id>/edit', views.student_edit, name='student_edit'),
    path('students/<int:id>/delete/', views.student_delete, name='student_delete'),
]