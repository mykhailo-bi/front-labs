from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json
from lab3_app import models, repositories as r

def _parse_body(request):
    if request.method in ('POST','PUT','PATCH'):
        if request.content_type == 'application/json':
            try:
                return json.loads(request.body.decode('utf-8') or '{}')
            except Exception:
                return {}
    # Fallback to form-data
    if request.method in ('POST','PUT','PATCH'):
        data = {}
        if request.POST:
            data = dict(request.POST)
        # remove empty
        return data
    return {}

def _to_user(u):
    return {
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'firstname': u.firstname,
        'lastname': u.lastname,
        'description': u.description,
        'phone': u.phone,
        'avatar_id': u.avatar_id,
    }

@csrf_exempt
def users(request):
    rep = r.UserRepository()
    if request.method == 'GET':
        users = rep.find_all()
        return JsonResponse([_to_user(u) for u in users], safe=False, status=200)
    if request.method == 'POST':
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        # Normalize foreign keys if needed
        if 'avatar' in payload:
            payload['avatar_id'] = payload.pop('avatar')
        if 'avatar_id' in payload and payload['avatar_id'] == '':
            payload.pop('avatar_id', None)
        # create
        try:
            user = rep.create(**payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        response = JsonResponse(_to_user(user), status=201)
        response['Location'] = f'/app/users/{user.id}/'
        return response
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def user_detail(request, id):
    rep = r.UserRepository()
    try:
        user = rep.find(id)
    except models.User.DoesNotExist:
        return JsonResponse({'error': f'User with id {id} not found!'}, status=404)

    if request.method == 'GET':
        return JsonResponse(_to_user(user), status=200)
    if request.method in ('PUT','PATCH'):
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        try:
            user = rep.update(id, **payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        return JsonResponse(_to_user(user), status=200)
    if request.method == 'DELETE':
        rep.delete(id)
        return HttpResponse(status=204)
    return JsonResponse({'error':'Method not allowed'}, status=405)

def _to_product(p):
    return {
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'price': float(p.price) if p.price is not None else None,
        'image_ids': [img.id for img in p.images.all()],
    }

@csrf_exempt
def products(request):
    rep = r.BaseRepository(models.Product)
    if request.method == 'GET':
        items = rep.find_all()
        return JsonResponse([_to_product(p) for p in items], safe=False, status=200)
    if request.method == 'POST':
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        try:
            product = rep.create(**payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        response = JsonResponse(_to_product(product), status=201)
        response['Location'] = f'/app/products/{product.id}/'
        return response
    return JsonResponse({'error':'Method not allowed'}, status=405)

@csrf_exempt
def product_detail(request, id):
    rep = r.BaseRepository(models.Product)
    try:
        product = rep.find(id)
    except models.Product.DoesNotExist:
        return JsonResponse({'error': f'Product with id {id} not found!'}, status=404)

    if request.method == 'GET':
        return JsonResponse(_to_product(product), status=200)
    if request.method in ('PUT','PATCH'):
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        try:
            product = rep.update(id, **payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        return JsonResponse(_to_product(product), status=200)
    if request.method == 'DELETE':
        try:
            rep.delete(id)
        except models.Product.DoesNotExist:
            return JsonResponse({'error': f'Product with id {id} not found!'}, status=404)
        return HttpResponse(status=204)
    return JsonResponse({'error':'Method not allowed'}, status=405)

def _to_order(o):
    return {
        'id': o.id,
        'user_id': o.user_id,
        'created_at': o.created_at.isoformat() if o.created_at else None,
        'updated_at': o.updated_at.isoformat() if o.updated_at else None,
        'product_ids': [p.id for p in o.products.all()],
    }

@csrf_exempt
def orders(request):
    rep = r.OrderRepository()
    if request.method == 'GET':
        items = rep.find_all()
        return JsonResponse([_to_order(o) for o in items], safe=False, status=200)
    if request.method == 'POST':
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        try:
            # Normalize user foreign key if needed
            if 'user' in payload and isinstance(payload['user'], int):
                payload['user_id'] = payload.pop('user')
            if 'user_id' not in payload and 'user' in payload:
                payload['user_id'] = int(payload.pop('user'))
            order = rep.create(**payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        response = JsonResponse(_to_order(order), status=201)
        response['Location'] = f'/app/orders/{order.id}/'
        return response
    return JsonResponse({'error':'Method not allowed'}, status=405)

@csrf_exempt
def order_detail(request, id):
    rep = r.OrderRepository()
    try:
        order = rep.find(id)
    except models.Order.DoesNotExist:
        return JsonResponse({'error': f'Order with id {id} not found!'}, status=404)

    if request.method == 'GET':
        return JsonResponse(_to_order(order), status=200)
    if request.method in ('PUT','PATCH'):
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        try:
            order = rep.update(id, **payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        return JsonResponse(_to_order(order), status=200)
    if request.method == 'DELETE':
        rep.delete(id)
        return JsonResponse({'status':'deleted'}, status=204)
    return JsonResponse({'error':'Method not allowed'}, status=405)

@csrf_exempt
def reviews(request):
    rep = r.ReviewRepository()
    if request.method == 'GET':
        items = rep.find_all()
        data = []
        for rev in items:
            data.append({
                'id': rev.id,
                'user_id': getattr(rev, 'user_id', None),
                'product_id': getattr(rev, 'product_id', None),
                'rating': rev.rating,
                'text': rev.text,
                'image_ids': [img.id for img in rev.images.all()] if hasattr(rev, 'images') else [],
            })
        return JsonResponse(data, safe=False, status=200)

    if request.method == 'POST':
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        # Normalize foreign keys if present as 'user'/'product'
        if 'user' in payload and isinstance(payload['user'], int):
            payload['user_id'] = payload.pop('user')
        if 'product' in payload and isinstance(payload['product'], int):
            payload['product_id'] = payload.pop('product')
        try:
            review = rep.create(**payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        response = JsonResponse({
            'id': review.id,
            'user_id': getattr(review, 'user_id', None),
            'product_id': getattr(review, 'product_id', None),
            'rating': review.rating,
            'text': review.text,
        }, status=201)
        response['Location'] = f'/app/reviews/{review.id}/'
        return response

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def review_detail(request, id):
    rep = r.ReviewRepository()
    try:
        review = rep.find(id)
    except models.Review.DoesNotExist:
        return JsonResponse({'error': f'Review with id {id} not found!'}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            'id': review.id,
            'user_id': getattr(review, 'user_id', None),
            'product_id': getattr(review, 'product_id', None),
            'rating': review.rating,
            'text': review.text,
            'image_ids': [img.id for img in review.images.all()] if hasattr(review, 'images') else [],
        }, status=200)

    if request.method in ('PUT', 'PATCH'):
        payload = _parse_body(request)
        if not isinstance(payload, dict):
            payload = {}
        try:
            review = rep.update(id, **payload)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
        return JsonResponse({
            'id': review.id,
            'user_id': getattr(review, 'user_id', None),
            'product_id': getattr(review, 'product_id', None),
            'rating': review.rating,
            'text': review.text,
        }, status=200)

    if request.method == 'DELETE':
        rep.delete(id)
        return HttpResponse(status=204)

    return JsonResponse({'error': 'Method not allowed'}, status=405)


@csrf_exempt
def aggregate_report(request):
    # Aggregate report across multiple models
    total_users = models.User.objects.count()
    total_products = models.Product.objects.count()
    total_orders = models.Order.objects.count()

    total_cart_items = 0
    for c in models.Cart.objects.all():
        total_cart_items += getattr(c, 'count', 0)

    total_price_vals = 0.0
    price_count = 0
    for p in models.Product.objects.all():
        if p.price is not None:
            total_price_vals += float(p.price)
            price_count += 1
    avg_product_price = (total_price_vals / price_count) if price_count else 0.0

    revenue = 0.0
    for oc in models.OrderContent.objects.all():
        price = oc.product.price if getattr(oc.product, 'price', None) else 0
        try:
            revenue += oc.count * float(price)
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
    return JsonResponse(report)