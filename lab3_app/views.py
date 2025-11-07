from django.http import HttpResponse, HttpResponseBadRequest, HttpResponseNotFound, HttpResponse
from django.core import serializers
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Avg
from lab3_app import models, repositories as r
import json

def index(request):
    return HttpResponse('Hello, World!')

def get_users(request):
    rep = r.BaseRepository(models.User)
    users = rep.find_all()
    return HttpResponse(serializers.serialize('json', users), content_type='application/json')

@csrf_exempt
def add_user(request):
    payload = {}
    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                payload = json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                payload = {}
        else:
            # Fallback to form-like data
            payload = {
                'username': request.POST.get('username'),
                'email': request.POST.get('email'),
                'password_hash': request.POST.get('password_hash'),
                'firstname': request.POST.get('firstname'),
                'lastname': request.POST.get('lastname'),
                'description': request.POST.get('description'),
                'phone': request.POST.get('phone'),
                'avatar_id': request.POST.get('avatar')
            }
            # If avatar provided as id, map to FK
            if payload.get('avatar_id'):
                payload['avatar_id'] = payload.pop('avatar_id')
            else:
                payload.pop('avatar_id', None)
    else:
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method!</body></html>')

    rep = r.UserRepository()
    try:
        user = rep.create(**payload)
    except Exception as e:
        return HttpResponseBadRequest(f'<html><head></head><body>Error creating user: {e}</body></html>')

    return HttpResponse(serializers.serialize('json', [user]), content_type='application/json')

@csrf_exempt
def update_user(request, id):
    if request.method not in ('PUT', 'POST'):
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method for update!</body></html>')
    payload = {}
    if request.content_type == 'application/json':
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            payload = {}
    else:
        # Basic form data
        payload = {
            'username': request.POST.get('username'),
            'email': request.POST.get('email'),
            'password_hash': request.POST.get('password_hash'),
            'firstname': request.POST.get('firstname'),
            'lastname': request.POST.get('lastname'),
            'description': request.POST.get('description'),
            'phone': request.POST.get('phone'),
        }
        # remove Nones
        payload = {k: v for k, v in payload.items() if v is not None}

    rep = r.UserRepository()
    try:
        user = rep.update(id, **payload)
    except models.User.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>User with id {id} not found!</body></html>')
    except Exception as e:
        return HttpResponseBadRequest(f'<html><head></head><body>Error updating user: {e}</body></html>')

    return HttpResponse(serializers.serialize('json', [user]), content_type='application/json')

@csrf_exempt
def delete_user(request, id):
    if request.method != 'DELETE':
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method for delete!</body></html>')
    rep = r.UserRepository()
    try:
        rep.delete(id)
    except models.User.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>User with id {id} not found!</body></html>')
    return HttpResponse(status=204)

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

@csrf_exempt
def add_product(request):
    payload = {}
    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                payload = json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                payload = {}
        else:
            payload = {
                'name': request.GET.get('name'),
                'description': request.GET.get('description'),
                'price': request.GET.get('price')
            }
    else:
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method!</body></html>')

    rep = r.BaseRepository(models.Product)
    try:
        product = rep.create(**payload)
    except Exception as e:
        return HttpResponseBadRequest(f'<html><head></head><body>Error creating product: {e}</body></html>')

    return HttpResponse(serializers.serialize('json', [product]), content_type='application/json')

@csrf_exempt
def update_product(request, id):
    if request.method not in ('PUT', 'POST'):
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method for update!</body></html>')
    payload = {}
    if request.content_type == 'application/json':
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            payload = {}
    else:
        payload = {
            'name': request.POST.get('name'),
            'description': request.POST.get('description'),
            'price': request.POST.get('price')
        }
        payload = {k: v for k, v in payload.items() if v is not None}

    rep = r.BaseRepository(models.Product)
    try:
        product = rep.update(id, **payload)
    except models.Product.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Product with id {id} not found!</body></html>')
    except Exception as e:
        return HttpResponseBadRequest(f'<html><head></head><body>Error updating product: {e}</body></html>')

    return HttpResponse(serializers.serialize('json', [product]), content_type='application/json')

@csrf_exempt
def delete_product(request, id):
    if request.method != 'DELETE':
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method for delete!</body></html>')
    rep = r.BaseRepository(models.Product)
    try:
        rep.delete(id)
    except models.Product.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Product with id {id} not found!</body></html>')
    return HttpResponse(status=204)

def get_product_images_by_id(request, id):
    rep = r.BaseRepository(models.Product)
    try:
        product = rep.find(id)
    except models.Product.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Product with id {id} not found!</body></html>')
    return HttpResponse(serializers.serialize('json', product.images.all()), content_type='application/json')

def get_product_by_id(request, id):
    rep = r.BaseRepository(models.Product)
    try:
        product = rep.find(id)
    except models.Product.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Product with id {id} not found!</body></html>')
    return HttpResponse(serializers.serialize('json', [product]), content_type='application/json')

def get_orders(request):
    rep = r.BaseRepository(models.Order)
    orders = rep.find_all()
    return HttpResponse(serializers.serialize('json', orders), content_type='application/json')

def get_order_by_id(request, id):
    rep = r.BaseRepository(models.Order)
    try:
        order = rep.find(id)
    except models.Order.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Order with id {id} not found!</body></html>')
    return HttpResponse(serializers.serialize('json', [order]), content_type='application/json')

@csrf_exempt
def add_order(request):
    payload = {}
    if request.method == 'POST':
        if request.content_type == 'application/json':
            try:
                payload = json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                payload = {}
        else:
            user_id = request.GET.get('user')
            if user_id is None:
                return HttpResponseBadRequest('<html><head></head><body>User not set!</body></html>')
            payload = {'user': user_id}
    else:
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method!</body></html>')

    order_rep = r.OrderRepository()
    user_rep = r.UserRepository()
    try:
        user = user_rep.find(payload['user'])
    except models.User.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>User with id {payload["user"]} not found!</body></html>')

    order = order_rep.create(user=user)

    # Optional: create OrderContent items if provided
    if isinstance(payload, dict) and payload.get('products'):
        for pc in payload['products']:
            prod_id = pc.get('product')
            count = pc.get('count', 1)
            try:
                product = models.Product.objects.get(id=prod_id)
                models.OrderContent.objects.create(order=order, product=product, count=count)
            except Exception:
                pass  # ignore failing items for simplicity

    return HttpResponse(serializers.serialize('json', [order]), content_type='application/json')

@csrf_exempt
def update_order(request, id):
    if request.method not in ('PUT', 'POST'):
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method!</body></html>')
    payload = {}
    if request.content_type == 'application/json':
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            payload = {}
    else:
        payload = {
            'user': request.POST.get('user')
        }
        payload = {k: v for k, v in payload.items() if v is not None}

    order_rep = r.OrderRepository()
    try:
        order = order_rep.update(id, **payload)
    except models.Order.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Order with id {id} not found!</body></html>')
    except Exception as e:
        return HttpResponseBadRequest(f'<html><head></head><body>Error updating order: {e}</body></html>')

    return HttpResponse(serializers.serialize('json', [order]), content_type='application/json')

@csrf_exempt
def delete_order(request, id):
    if request.method != 'DELETE':
        return HttpResponseBadRequest('<html><head></head><body>Unsupported method for delete!</body></html>')
    rep = r.OrderRepository()
    try:
        rep.delete(id)
    except models.Order.DoesNotExist:
        return HttpResponseNotFound(f'<html><head></head><body>Order with id {id} not found!</body></html>')
    return HttpResponse(status=204)

def aggregate_report(request):
    # Aggregate report across multiple models
    total_users = models.User.objects.count()
    total_products = models.Product.objects.count()
    total_orders = models.Order.objects.count()

    total_cart_items = models.Cart.objects.aggregate(total=Sum('count'))['total'] or 0

    avg_product_price = models.Product.objects.aggregate(avg=Avg('price'))['avg']
    if avg_product_price is None:
        avg_product_price = 0

    # Revenue: sum of (order_content.count * product.price)
    revenue = 0
    for oc in models.OrderContent.objects.all():
        try:
            revenue += oc.count * (oc.product.price or 0)
        except Exception:
            pass

    report = {
        'total_users': total_users,
        'total_products': total_products,
        'total_orders': total_orders,
        'total_cart_items': int(total_cart_items),
        'average_product_price': float(avg_product_price),
        'revenue': float(revenue)
    }
    return HttpResponse(json.dumps(report), content_type='application/json')
