from django.shortcuts import render, get_object_or_404, redirect
from lab3_app import repositories as repo
from .forms import ReviewForm


def _normalize_fk_kwargs(data: dict):
    data = dict(data)    
    for field in ('user', 'product', 'avatar'):
        if field in data:
            val = data.pop(field)
            if hasattr(val, 'id'):
                data[f'{field}_id'] = val.id
            else:
                try:
                    data[f'{field}_id'] = int(val)
                except Exception:
                    pass
    return data


def review_list(request):
    rep = repo.ReviewRepository()
    reviews = rep.find_all()
    return render(request, 'lab5_app/review_list.html', {'reviews': reviews})


def review_detail(request, id):
    rep = repo.ReviewRepository()
    review = rep.find(id)
    return render(request, 'lab5_app/review_detail.html', {'review': review})


def review_create(request):
    rep = repo.ReviewRepository()
    if request.method == 'POST':
        form = ReviewForm(request.POST)
        if form.is_valid():
            data = _normalize_fk_kwargs(form.cleaned_data)
            try:
                review = rep.create(**data)
            except Exception as e:
                return render(request, 'lab5_app/bad.html', {'error_message': e, 'callback': 'lab5_app:review_create'})
            return redirect('lab5_app:review_detail', id=review.id)
    else:
        form = ReviewForm()
    return render(request, 'lab5_app/review_form.html', {'form': form, 'is_edit': False})


def review_edit(request, id):
    rep = repo.ReviewRepository()
    review = rep.find(id)
    if request.method == 'POST':
        form = ReviewForm(request.POST, instance=review)
        if form.is_valid():
            data = _normalize_fk_kwargs(form.cleaned_data)
            try:
                review = rep.update(id, **data)
            except Exception as e:
                return render(request, 'lab5_app/bad.html', {'error_message': e, 'callback': 'lab5_app:review_edit', 'params': {'id': id}})
            return redirect('lab5_app:review_detail', id=review.id)
    else:
        form = ReviewForm(instance=review)
    return render(request, 'lab5_app/review_form.html', {'form': form, 'is_edit': True, 'review': review})


def review_delete(request, id):
    rep = repo.ReviewRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:review_list')
    review = rep.find(id)
    return render(request, 'lab5_app/review_delete_confirm.html', {'review': review})


def user_list(request):
    rep = repo.UserRepository()
    users = rep.find_all()
    return render(request, 'lab5_app/user_list.html', {'users': users})


def user_detail(request, id):
    rep = repo.UserRepository()
    user = rep.find(id)
    return render(request, 'lab5_app/user_detail.html', {'user': user})


def user_delete(request, id):
    rep = repo.UserRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:user_list')
    user = rep.find(id)
    return render(request, 'lab5_app/user_delete_confirm.html', {'user': user})


def product_list(request):
    rep = repo.ProductRepository()
    products = rep.find_all()
    return render(request, 'lab5_app/product_list.html', {'products': products})


def product_detail(request, id):
    rep = repo.ProductRepository()
    product = rep.find(id)
    return render(request, 'lab5_app/product_detail.html', {'product': product})


def product_delete(request, id):
    rep = repo.ProductRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:product_list')
    product = rep.find(id)
    return render(request, 'lab5_app/product_delete_confirm.html', {'product': product})


def cart_list(request):
    rep = repo.CartRepository()
    carts = rep.find_all()
    return render(request, 'lab5_app/cart_list.html', {'carts': carts})


def cart_detail(request, id):
    rep = repo.CartRepository()
    cart = rep.find(id)
    return render(request, 'lab5_app/cart_detail.html', {'cart': cart})


def cart_delete(request, id):
    rep = repo.CartRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:cart_list')
    cart = rep.find(id)
    return render(request, 'lab5_app/cart_delete_confirm.html', {'cart': cart})


def image_list(request):
    rep = repo.ImageRepository()
    images = rep.find_all()
    return render(request, 'lab5_app/image_list.html', {'images': images})


def image_detail(request, id):
    rep = repo.ImageRepository()
    image = rep.find(id)
    return render(request, 'lab5_app/image_detail.html', {'image': image})


def image_delete(request, id):
    rep = repo.ImageRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:image_list')
    image = rep.find(id)
    return render(request, 'lab5_app/image_delete_confirm.html', {'image': image})


def order_list(request):
    rep = repo.OrderRepository()
    orders = rep.find_all()
    return render(request, 'lab5_app/order_list.html', {'orders': orders})


def order_detail(request, id):
    rep = repo.OrderRepository()
    order = rep.find(id)
    return render(request, 'lab5_app/order_detail.html', {'order': order})


def order_delete(request, id):
    rep = repo.OrderRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:order_list')
    order = rep.find(id)
    return render(request, 'lab5_app/order_delete_confirm.html', {'order': order})


def ordercontent_list(request):
    rep = repo.OrderContentRepository()
    items = rep.find_all()
    return render(request, 'lab5_app/ordercontent_list.html', {'items': items})
 
 
def ordercontent_detail(request, id):
    rep = repo.OrderContentRepository()
    item = rep.find(id)
    return render(request, 'lab5_app/ordercontent_detail.html', {'item': item})
 
 
def ordercontent_delete(request, id):
    rep = repo.OrderContentRepository()
    if request.method == 'POST':
        rep.delete(id)
        return redirect('lab5_app:ordercontent_list')
    item = rep.find(id)
    return render(request, 'lab5_app/ordercontent_delete_confirm.html', {'item': item})
 
 
def aggregate_report(request):
    from lab3_app import models as m

    total_users = m.User.objects.count()
    total_products = m.Product.objects.count()
    total_orders = m.Order.objects.count()

    total_cart_items = 0
    for c in m.Cart.objects.all():
        total_cart_items += getattr(c, 'count', 0)

    total_price_vals = 0.0
    price_count = 0
    for p in m.Product.objects.all():
        if getattr(p, 'price', None) is not None:
            try:
                total_price_vals += float(p.price)
                price_count += 1
            except Exception:
                pass
    avg_product_price = (total_price_vals / price_count) if price_count else 0.0

    revenue = 0.0
    for oc in m.OrderContent.objects.all():
        price = oc.product.price if getattr(oc.product, 'price', None) else 0
        try:
            revenue += oc.count * float(price)
        except Exception:
            pass

    report = {
        'total_users': int(total_users),
        'total_products': int(total_products),
        'total_orders': int(total_orders),
        'total_cart_items': int(total_cart_items),
        'average_product_price': float(avg_product_price),
        'revenue': float(revenue),
    }

    return render(request, 'lab5_app/aggregate_report.html', {'report': report})
