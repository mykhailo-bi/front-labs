from django.urls import path
from . import views

app_name = 'lab5_app'

urlpatterns = [
    # Reviews
    path('reviews/', views.review_list, name='review_list'),
    path('reviews/add/', views.review_create, name='review_create'),
    path('reviews/<int:id>/', views.review_detail, name='review_detail'),
    path('reviews/<int:id>/edit/', views.review_edit, name='review_edit'),
    path('reviews/<int:id>/delete/', views.review_delete, name='review_delete'),

    path('users/', views.user_list, name='user_list'),
    path('users/<int:id>/', views.user_detail, name='user_detail'),
    path('users/<int:id>/delete/', views.user_delete, name='user_delete'),

    path('products/', views.product_list, name='product_list'),
    path('products/<int:id>/', views.product_detail, name='product_detail'),
    path('products/<int:id>/delete/', views.product_delete, name='product_delete'),

    path('carts/', views.cart_list, name='cart_list'),
    path('carts/<int:id>/', views.cart_detail, name='cart_detail'),
    path('carts/<int:id>/delete/', views.cart_delete, name='cart_delete'),

    path('images/', views.image_list, name='image_list'),
    path('images/<int:id>/', views.image_detail, name='image_detail'),
    path('images/<int:id>/delete/', views.image_delete, name='image_delete'),

    path('orders/', views.order_list, name='order_list'),
    path('orders/<int:id>/', views.order_detail, name='order_detail'),
    path('orders/<int:id>/delete/', views.order_delete, name='order_delete'),

    path('ordercontents/', views.ordercontent_list, name='ordercontent_list'),
    path('ordercontents/<int:id>/', views.ordercontent_detail, name='ordercontent_detail'),
    path('ordercontents/<int:id>/delete/', views.ordercontent_delete, name='ordercontent_delete'),

    path('reports/aggregate/', views.aggregate_report, name='aggregate_report'),
]