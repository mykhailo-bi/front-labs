# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class Cart(models.Model):
    user = models.ForeignKey('User', models.DO_NOTHING)
    product = models.ForeignKey('Product', models.DO_NOTHING)
    count = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'cart'
        unique_together = (('user', 'product'),)


class Image(models.Model):
    url = models.CharField(max_length=1024)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'image'


class Order(models.Model):
    user = models.ForeignKey('User', models.DO_NOTHING)
    products = models.ManyToManyField('Product', through='OrderContent')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'order'


class OrderContent(models.Model):
    order = models.ForeignKey(Order, models.DO_NOTHING)
    product = models.ForeignKey('Product', models.DO_NOTHING)
    count = models.IntegerField()

    class Meta:
        
        db_table = 'order_content'
        unique_together = (('order', 'product'),)


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    images = models.ManyToManyField(Image, through='ProductImage')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'product'


class ProductImage(models.Model):
    product = models.ForeignKey(Product, models.DO_NOTHING)
    image = models.ForeignKey(Image, models.DO_NOTHING)
    alt_text = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        
        db_table = 'product_image'
        unique_together = (('product', 'image'),)


class Review(models.Model):
    user = models.ForeignKey('User', models.DO_NOTHING)
    product = models.ForeignKey(Product, models.DO_NOTHING)
    rating = models.IntegerField()
    text = models.TextField(blank=True, null=True)
    images = models.ManyToManyField(Image, through='ReviewImage')

    class Meta:
        
        db_table = 'review'
        unique_together = (('user', 'product'),)


class ReviewImage(models.Model):
    review = models.ForeignKey(Review, models.DO_NOTHING)
    image = models.ForeignKey(Image, models.DO_NOTHING)

    class Meta:
        
        db_table = 'review_image'
        unique_together = (('review', 'image'),)


class User(models.Model):
    username = models.CharField(unique=True, max_length=32)
    email = models.CharField(unique=True, max_length=64)
    password_hash = models.CharField(max_length=60)
    firstname = models.CharField(max_length=32, blank=True, null=True)
    lastname = models.CharField(max_length=32, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    phone = models.CharField(unique=True, max_length=16, blank=True, null=True)
    is_admin = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    avatar = models.ForeignKey(Image, models.DO_NOTHING, blank=True, null=True)
    products_in_cart = models.ManyToManyField('Product', through='Cart')

    class Meta:
        
        db_table = 'user'
