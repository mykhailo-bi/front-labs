from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('users/', views.get_users, name='users'),
    path('users/<int:id>/', views.get_user_by_id, name='user_id'),
    path('products/', views.get_products, name='products'),
    path('products/<int:id>/', views.get_product_by_id, name='product_id'),
    path('products/add/', views.add_product, name='product_add'),
    path('orders/', views.get_orders, name='order'),
    path('orders/<int:id>/', views.get_order_by_id, name='order_id'),
    path('orders/add/', views.add_order, name='order_add'),
]