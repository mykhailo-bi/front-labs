from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('users/', views.get_users, name='users'),
    path('users/add/', views.add_user, name='user_add'),
    path('users/<int:id>/', views.get_user_by_id, name='user_id'),
    path('users/<int:id>/update/', views.update_user, name='user_update'),
    path('users/<int:id>/delete/', views.delete_user, name='user_delete'),
    path('products/', views.get_products, name='products'),
    path('products/add/', views.add_product, name='product_add'),
    path('products/<int:id>/', views.get_product_by_id, name='product_id'),
    path('products/<int:id>/update/', views.update_product, name='product_update'),
    path('products/<int:id>/delete/', views.delete_product, name='product_delete'),
    path('products/<int:id>/images/', views.get_product_images_by_id, name='product_images'),
    path('orders/', views.get_orders, name='order'),
    path('orders/add/', views.add_order, name='order_add'),
    path('orders/<int:id>/', views.get_order_by_id, name='order_id'),
    path('orders/<int:id>/update/', views.update_order, name='order_update'),
    path('orders/<int:id>/delete/', views.delete_order, name='order_delete'),
    path('reports/aggregate/', views.aggregate_report, name='aggregate_report'),
]