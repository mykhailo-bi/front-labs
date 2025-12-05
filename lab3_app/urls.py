from django.urls import path

from . import views

urlpatterns = [
    path('users/', views.users),
    path('users/<int:id>/', views.user_detail),
    path('products/', views.products),
    path('products/<int:id>/', views.product_detail),
    path('orders/', views.orders),
    path('orders/<int:id>/', views.order_detail),
    path('reviews/', views.reviews),
    path('reviews/<int:id>/', views.review_detail),
    path('reports/aggregate/', views.aggregate_report),
]