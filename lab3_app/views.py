from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseNotFound, HttpResponse
from django.core import serializers
from lab3_app import models, repositories as r

def index(request):
    return HttpResponse('Hello, World!')

def get_users(request):
    rep = r.BaseRepository(models.User)
    users = rep.find_all()
    return HttpResponse(serializers.serialize('json', users), content_type='application/json')

def get_user_by_id(request, id):
    rep = r.BaseRepository(models.User)
    try:
        user = rep.find(id)
    except models.User.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>User with id {id} not found!</body></html>')
    return HttpResponse(serializers.serialize('json', [user]), content_type='application/json')

def get_products(request):
    rep = r.BaseRepository(models.Product)
    products = rep.find_all()
    return HttpResponse(serializers.serialize('json', products), content_type='application/json')

def get_product_by_id(request, id):
    rep = r.BaseRepository(models.Product)
    try:
        product = rep.find(id)
    except models.Product.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Product with id {id} not found!</body></html>')
    return HttpResponse(serializers.serialize('json', [product]), content_type='application/json')

def add_product(request):
    name = request.GET.get('name')
    description = request.GET.get('description')
    price = request.GET.get('price')
    if None in (name, price):
        return HttpResponseBadRequest('<html><head></head><body>Name or price not set!</body></html>')
    rep = r.BaseRepository(models.Product)
    product = rep.create(name=name, description=description, price=price)
    return HttpResponse(serializers.serialize('json', [product]), content_type='application/json')

def get_orders(request):
    rep = r.BaseRepository(models.Order)
    orders = rep.find_all()
    return HttpResponse(serializers.serialize('json', orders), content_type='application/json')

def get_order_by_id(request, id):
    rep = r.BaseRepository(models.Order)
    try:
        order = rep.find(id)
    except models.Product.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Order with id {id} not found!</body></html>')
    return HttpResponse(serializers.serialize('json', [order]), content_type='application/json')

def add_order(request):
    user_id = request.GET.get('user')
    if user_id is None:
        return HttpResponseBadRequest('<html><head></head><body>User not set!</body></html>')
    user_rep = r.BaseRepository(models.User)
    try:
        user = user_rep.find(user_id)
    except models.User.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>User with id {user_id} not found!</body></html>')
    order_rep = r.BaseRepository(models.Order)
    order = order_rep.create(user=user)
    return HttpResponse(serializers.serialize('json', [order]), content_type='application/json')
