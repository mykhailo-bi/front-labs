from lab3_app.models import *

class BaseRepository:
    def __init__(self, model):
        self.model = model

    def find_all(self):
        return self.model.objects.all()

    def find(self, id):
        return self.model.objects.get(id=id)

    def create(self, **kwargs):
        return self.model.objects.create(**kwargs)

    def update(self, id, **kwargs):
        # Update fields for the given id and return the updated instance
        self.model.objects.filter(id=id).update(**kwargs)
        return self.find(id)

    def delete(self, id):
        obj = self.find(id)
        obj.delete()
        return True

class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__(User)

    # Add extra operations related to User if needed here


class CartRepository(BaseRepository):
    def __init__(self):
        super().__init__(Cart)

    # Add extra operations related to Cart if needed here


class ImageRepository(BaseRepository):
    def __init__(self):
        super().__init__(Image)

    # Add extra operations related to Image if needed here


class OrderRepository(BaseRepository):
    def __init__(self):
        super().__init__(Order)

    # Add extra operations related to Order if needed here


class OrderContentRepository(BaseRepository):
    def __init__(self):
        super().__init__(OrderContent)

    # Add extra operations related to Order Content if needed here


class ProductRepository(BaseRepository):
    def __init__(self):
        super().__init__(Product)

    # Add extra operations related to Product if needed here


class ProductImageRepository(BaseRepository):
    def __init__(self):
        super().__init__(ProductImage)

    # Add extra operations related to Product Image if needed here


class ReviewRepository(BaseRepository):
    def __init__(self):
        super().__init__(Review)

    # Add extra operations related to Review if needed here


class ReviewImageRepository(BaseRepository):
    def __init__(self):
        super().__init__(ReviewImage)

    # Add extra operations related to Review Image if needed here