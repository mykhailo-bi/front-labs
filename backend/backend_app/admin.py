from django.contrib import admin
from django.contrib.admin import AdminSite
from django.http import HttpRequest

from backend_app import models


class IsAdminSite(AdminSite):
    site_header = "Backend Admin"
    site_title = "Backend Admin"
    index_title = "Admin"

    def has_permission(self, request: HttpRequest) -> bool:  # type: ignore[override]
        user = getattr(request, "user", None)
        if not user:
            return False
        if getattr(user, "is_admin", False):
            return True
        return bool(
            getattr(user, "is_active", True) and (user.is_staff or user.is_superuser)
        )


admin_site = IsAdminSite(name="is_admin_site")


@admin.register(models.Product, site=admin_site)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "sku", "status", "is_published", "price", "stock_qty")
    search_fields = ("name", "description", "sku")
    list_filter = ("status", "is_published", "category")


@admin.register(models.Category, site=admin_site)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "parent")
    search_fields = ("name", "slug")


@admin.register(models.User, site=admin_site)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "is_admin", "created_at")
    search_fields = ("username", "email")


@admin.register(models.Order, site=admin_site)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "status", "total", "created_at")
    search_fields = ("id",)
    list_filter = ("status",)


@admin.register(models.Image, site=admin_site)
class ImageAdmin(admin.ModelAdmin):
    list_display = ("id", "url", "created_at")


@admin.register(models.ProductImage, site=admin_site)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "image", "alt_text")


@admin.register(models.Address, site=admin_site)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "label", "full_name", "city", "country", "is_default")
    search_fields = ("label", "full_name", "city", "country")


@admin.register(models.WishlistItem, site=admin_site)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "created_at")


@admin.register(models.SavedItem, site=admin_site)
class SavedItemAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "created_at")


@admin.register(models.Review, site=admin_site)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "rating")


@admin.register(models.PaymentAttempt, site=admin_site)
class PaymentAttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "provider", "status", "created_at")


@admin.register(models.BlacklistedToken, site=admin_site)
class BlacklistedTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "token_type", "expires_at")


@admin.register(models.PasswordResetToken, site=admin_site)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "token", "expires_at", "used_at")


# Replace default admin site with restricted one
admin.site = admin_site
